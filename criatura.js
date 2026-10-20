// Editor de criaturas, monstros e chefes (usa as funções de app.js: api, esc, toast, $, $$, modal, escolher, agendarSalvar...).
const CR = { funcoes: [['Soldier', 'Soldado'], ['Brute', 'Bruto'], ['Skirmisher', 'Escaramuçador'], ['Artillery', 'Artilheiro'], ['Controller', 'Controlador'], ['Lurker', 'Espreitador'], ['None', 'Sem função']],
  grupos: [['Standard', 'Padrão'], ['Elite', 'Elite'], ['Solo', 'Solo'], ['Minion', 'Lacaio']],
  tamanhos: [['Tiny', 'Miúdo'], ['Small', 'Pequeno'], ['Medium', 'Médio'], ['Large', 'Grande'], ['Huge', 'Enorme'], ['Gargantuan', 'Imenso']],
  categorias: [['rasgo', 'Característica (passiva)'], ['padrao', 'Ação padrão'], ['movimento', 'Ação de movimento'], ['menor', 'Ação menor'], ['gatilho', 'Ação desencadeada'], ['livre', 'Ação livre']],
  usos: [['at-will', 'Sem limite'], ['encounter', 'Encontro'], ['daily', 'Diário'], ['recharge', 'Recarga'], ['aura', 'Aura'], ['', '—']],
  acoes: [['immediate reaction', 'Reação imediata'], ['immediate interrupt', 'Interrupção imediata'], ['opportunity', 'Ação de oportunidade'], ['no action', 'Sem ação'], ['free', 'Ação livre']],
  defesas: ['AC', 'Fort', 'Ref', 'Will'], atributos: [['for', 'FOR'], ['con', 'CON'], ['des', 'DES'], ['int', 'INT'], ['sab', 'SAB'], ['car', 'CAR']] };
let CR_ABA = sessionStorage.getItem('abaCriatura') || 'estat';
let CR_MACROS = {}, CR_DER = null, CR_BLOCO = '', crTimer = null;
const crOpt = (lista, atual) => lista.map(([v, n]) => `<option value="${esc(v)}" ${String(atual ?? '') === v ? 'selected' : ''}>${esc(n)}</option>`).join('');

async function abrirCriatura(id) {
  $('#principal').innerHTML = '<div class="carregando">Invocando a criatura…</div>';
  if (id) { try { P = await api('/api/personagens/' + id); } catch (e) { toast(esc(e.message), true); return desenharHome(); } }
  P.notas = P.notas || []; P.historico = P.historico || []; P.poderes = P.poderes || []; P.atr = P.atr || { for: 10, con: 10, des: 10, int: 10, sab: 10, car: 10 };
  P.poderes.forEach((p) => { if (!p.id) p.id = uid(); p.extras = p.extras || []; });
  desenharCriatura();
  P.notas.filter((n) => n.janela?.aberta).forEach((n) => abrirJanelaNota(n.id));
}

async function novaCriaturaUI() {
  $('#leitor').innerHTML = `<h3>🐉 Nova criatura</h3><p class="text-muted">Monte um monstro, chefe ou NPC do zero, ou comece de um do compêndio (mais de 5 mil) e ajuste.</p>
    <div class="d-grid gap-2"><button class="btn-rpg" id="cr-branco">✏️ Em branco (eu calculo com a função e o nível)</button>
    <button class="btn-rpg-sec" id="cr-comp">📖 Partir de um monstro do compêndio</button></div>`;
  modal('modalLeitor').show();
  $('#cr-branco').onclick = async () => { modal('modalLeitor').hide(); const c = await api('/api/criatura/nova', { method: 'POST', body: {} }); await autoCalcularNovo(c.id); };
  $('#cr-comp').onclick = () => {
    modal('modalLeitor').hide();
    setTimeout(() => escolher({ cats: ['monster'], titulo: 'Escolha o monstro-base', filtros: { nivelMax: '' }, onPick: async (m) => {
      const c = await api('/api/criatura/nova', { method: 'POST', body: { monstroId: m.ID } });
      toast(`<b>${esc(c.nome)}</b> copiado do compêndio. Ajuste o que quiser: é uma cópia sua.`, false, 7000);
      abrirCriatura(c.id);
    } }), 350);
  };
}
async function autoCalcularNovo(id) {
  await abrirCriatura(id);
  await crAplicarSugestao(true);
}
// Cria a criatura direto do leitor do compêndio (botão "Criar criatura a partir deste monstro")
async function criaturaDeMonstro(monstroId) {
  const c = await api('/api/criatura/nova', { method: 'POST', body: { monstroId } });
  modal('modalLeitor').hide();
  toast(`<b>${esc(c.nome)}</b> copiado do compêndio. Ajuste o que quiser.`, false, 6000);
  abrirCriatura(c.id);
}

function desenharCriatura() {
  const abas = [['estat', '📊 Estatísticas'], ['poderes', '⚔️ Poderes e características'], ['bloco', '📜 Bloco de estatísticas'], ['notas', '🗒️ Anotações do mestre']];
  $('#principal').innerHTML = `
    <div class="folha mb-2"><div class="faixa-nome">
      <div class="ret" style="font-size:2.6rem">🐉</div>
      <div class="flex-grow-1" style="min-width:230px"><input class="nome-grande" data-c="nome" value="${esc(P.nome)}" placeholder="Nome da criatura">
        <div class="rotulo mt-1" id="cr-resumo"></div></div>
      <div class="text-end"><button class="btn-rpg" id="cr-copiar-r20" title="Copia a criatura para o Roll20 (botão Grimório da extensão)">📋 Copiar p/ Roll20</button>
        <button class="btn-rpg-mini" id="cr-baixar-r20">.roll20.json</button>
        <button class="btn-rpg-mini" id="cr-json" title="Cópia exata da criatura (para guardar ou mandar a outro mestre)">.json</button>
        <div class="rotulo mt-2" id="status-salvo">Salvo ✓ ${dataBR(P.atualizado)}</div></div></div></div>
    <div class="abas">${abas.map(([k, n]) => `<div class="aba ${CR_ABA === k ? 'ativa' : ''}" data-aba="${k}">${n}</div>`).join('')}</div>
    <div id="conteudo-aba"></div>`;
  $$('.aba').forEach((a) => a.onclick = () => { CR_ABA = a.dataset.aba; sessionStorage.setItem('abaCriatura', CR_ABA); $$('.aba').forEach((x) => x.classList.toggle('ativa', x === a)); desenharAbaCriatura(); });
  $('[data-c="nome"]').oninput = (e) => { P.nome = e.target.value; crMudou(); };
  $('#cr-copiar-r20').onclick = async (e) => {
    e.target.disabled = true;
    try { await salvarAgora(); const f = await crFichaR20(); await copiarTexto(JSON.stringify(f)); toast('Criatura copiada. No Roll20: botão "Grimório" (extensão), cole e importe.', false, 9000); }
    catch (err) { toast('Roll20: ' + esc(err.message), true, 8000); }
    e.target.disabled = false;
  };
  $('#cr-baixar-r20').onclick = async () => {
    try { await salvarAgora(); const f = await crFichaR20(); crBaixar(JSON.stringify(f), (P.nome || 'criatura').replace(/[^\w-]+/g, '_') + '.roll20.json'); } catch (err) { toast('Roll20: ' + esc(err.message), true); }
  };
  $('#cr-json').onclick = async () => { await salvarAgora(); crBaixar(JSON.stringify(P), (P.nome || 'criatura').replace(/[^\w-]+/g, '_') + '.json'); };
  desenharAbaCriatura();
  crDerivar();
}
const crFichaR20 = () => fetch('/api/exportar-roll20', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) }).then(async (r) => { if (!r.ok) throw new Error('Falha ao gerar.'); return r.json(); });
function crBaixar(texto, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' })); a.download = nome; a.click(); }

function crMudou() { agendarSalvar(); clearTimeout(crTimer); crTimer = setTimeout(crDerivar, 250); }
async function crDerivar() {
  if (!P || P.tipo !== 'criatura') return;
  try {
    const r = await api('/api/criatura/derivar', { method: 'POST', body: { ...P, notas: [], historico: [], retrato: null } });
    CR_DER = r.derivados; CR_MACROS = r.macros; CR_BLOCO = r.bloco;
    const d = r.derivados, s = d.sugestao;
    const set = (k, v) => $$(`[data-cr="${k}"]`).forEach((e) => { e.textContent = v; });
    ATRS_CR.forEach(([k]) => set('b:' + k, (d.bonus[k] >= 0 ? '+' : '') + d.bonus[k]));
    set('xp', d.xp); set('sangrando', d.sangrando);
    for (const k of ['ca', 'fort', 'ref', 'vont', 'iniciativa', 'pv']) set('s:' + k, s[k]);
    set('s:pontosAcao', s.pontosAcao || '0'); set('s:testesResist', s.testesResist ? '+' + s.testesResist : '0');
    const fn = (CR.funcoes.find((f) => f[0] === P.funcao) || [])[1], gr = (CR.grupos.find((g) => g[0] === P.grupo) || [])[1];
    const el = $('#cr-resumo'); if (el) el.textContent = `Nível ${P.nivel} · ${gr}${P.funcao !== 'None' ? ' ' + fn : ''}${P.lider ? ' (Líder)' : ''} · ${d.xp} XP`;
    if (CR_ABA === 'bloco') $('#cr-bloco').innerHTML = CR_BLOCO;
  } catch (e) { /* servidor ocupado: tenta no próximo ajuste */ }
}
const ATRS_CR = CR.atributos;

async function crAplicarSugestao(tudo) {
  const r = await api('/api/criatura/sugerir', { method: 'POST', body: { criatura: P } });
  if (tudo && r.atributos) P.atr = r.atributos;
  const e = r.estatisticas;
  P.ca = e.ca; P.fort = e.fort; P.ref = e.ref; P.vont = e.vont; P.iniciativa = e.iniciativa; P.pv = e.pv;
  P.pontosAcao = e.pontosAcao ? String(e.pontosAcao) : ''; P.testesSalvamento = e.testesResist ? String(e.testesResist) : '';
  P.historico.push({ quando: new Date().toISOString(), tipo: 'calculo', texto: 'Estatísticas calculadas automaticamente pela função e nível.' });
  agendarSalvar(); desenharAbaCriatura(); crDerivar();
}

function desenharAbaCriatura() {
  const c = $('#conteudo-aba');
  if (CR_ABA === 'estat') return abaEstatCriatura(c);
  if (CR_ABA === 'poderes') return abaPoderesCriatura(c);
  if (CR_ABA === 'bloco') return abaBlocoCriatura(c);
  return abaNotas();
}

function crCampoNum(rotulo, caminho, extra = '', sug = '') {
  return `<div class="col-6 col-md-2"><label class="rotulo">${rotulo}</label><input type="number" class="form-control" data-cn="${caminho}" value="${esc(ler(caminho) ?? '')}" ${extra}>${sug ? `<div class="rotulo" title="Valor médio dos monstros do compêndio com este nível, função e grupo">sugerido <b data-cr="s:${sug}"></b></div>` : ''}</div>`;
}
function crCampoTxt(rotulo, caminho, larg = 'col-md-4', area = false, sug = '') {
  return `<div class="col-12 ${larg}"><label class="rotulo">${rotulo}</label>${sug ? `<span class="rotulo"> · sugerido <b data-cr="s:${sug}"></b></span>` : ''}${area ? `<textarea class="form-control" rows="3" data-ct="${caminho}">${esc(ler(caminho) ?? '')}</textarea>` : `<input class="form-control" data-ct="${caminho}" value="${esc(ler(caminho) ?? '')}">`}</div>`;
}
function crLigar(raiz) {
  $$('[data-cn]', raiz).forEach((i) => i.oninput = () => { definir(P, i.dataset.cn, i.value === '' ? '' : +i.value); crMudou(); });
  $$('[data-ct]', raiz).forEach((i) => i.oninput = () => { definir(P, i.dataset.ct, i.value); crMudou(); });
  $$('[data-cs]', raiz).forEach((i) => i.onchange = () => { definir(P, i.dataset.cs, i.value); crMudou(); if (i.dataset.cs === 'nivel' || i.dataset.cs === 'funcao' || i.dataset.cs === 'grupo') crDerivar(); });
  $$('[data-ck]', raiz).forEach((i) => i.onchange = () => { definir(P, i.dataset.ck, i.checked); crMudou(); });
}

function abaEstatCriatura(c) {
  c.innerHTML = `<div class="folha"><h2>Identidade</h2><div class="row g-2">
      <div class="col-6 col-md-2"><label class="rotulo">Nível</label><input type="number" min="0" max="40" class="form-control" data-cn="nivel" value="${esc(P.nivel)}"></div>
      <div class="col-6 col-md-3"><label class="rotulo">Função</label><select class="form-select" data-cs="funcao">${crOpt(CR.funcoes, P.funcao)}</select></div>
      <div class="col-6 col-md-3"><label class="rotulo">Grupo</label><select class="form-select" data-cs="grupo">${crOpt(CR.grupos, P.grupo)}</select></div>
      <div class="col-6 col-md-2"><label class="rotulo">Tamanho</label><select class="form-select" data-cs="tamanho">${crOpt(CR.tamanhos, P.tamanho)}</select></div>
      <div class="col-12 col-md-2 d-flex align-items-end"><label><input type="checkbox" data-ck="lider" ${P.lider ? 'checked' : ''}> Líder</label></div>
      ${crCampoTxt('Origem e tipo (ex.: natural humanoid, orc)', 'tipoTexto', 'col-md-5')}
      ${crCampoTxt('Tendência', 'tendencia', 'col-md-3')}${crCampoTxt('Idiomas', 'idiomas', 'col-md-4')}
      <div class="col-6 col-md-2"><label class="rotulo">XP (automático)</label><div class="form-control" style="background:var(--md-surface-container-highest);font-weight:700" data-cr="xp"></div></div>
      <div class="col-6 col-md-2"><label class="rotulo">XP manual</label><input type="number" class="form-control" data-cn="xpManual" value="${esc(P.xpManual ?? '')}" placeholder="vazio = tabela"></div>
    </div>
    <div class="d-flex gap-2 flex-wrap align-items-center mt-3"><button class="btn-rpg" id="cr-auto">🧮 Calcular defesas, PV, iniciativa, testes de resistência e pontos de ação</button>
      <button class="btn-rpg-sec" id="cr-auto-atr" title="Define os seis atributos de acordo com a função e o nível">Sugerir atributos</button>
      <span class="rotulo">Os valores "sugerido" vêm da média dos 5.300 monstros do compêndio; você pode digitar qualquer número.</span></div></div>
    <div class="folha mt-2"><h2>Combate</h2><div class="row g-2">
      ${crCampoNum('PV', 'pv', 'min="0"', 'pv')}<div class="col-6 col-md-2"><label class="rotulo">Sangrando</label><div class="form-control" style="background:var(--md-surface-container-highest)" data-cr="sangrando"></div></div>
      ${crCampoNum('Iniciativa', 'iniciativa', '', 'iniciativa')}${crCampoNum('CA', 'ca', '', 'ca')}${crCampoNum('Fortitude', 'fort', '', 'fort')}${crCampoNum('Reflexos', 'ref', '', 'ref')}${crCampoNum('Vontade', 'vont', '', 'vont')}
      ${crCampoTxt('Deslocamento (ex.: 6, fly 8 (hover), climb 4)', 'velocidade', 'col-md-4')}${crCampoTxt('Sentidos', 'sentidos', 'col-md-4')}
      ${crCampoTxt('Pontos de ação', 'pontosAcao', 'col-md-2', false, 'pontosAcao')}${crCampoTxt('Testes de resistência', 'testesSalvamento', 'col-md-2', false, 'testesResist')}
      ${crCampoTxt('Imune', 'imunidades', 'col-md-4')}${crCampoTxt('Resistências (ex.: 20 fire)', 'resistencias', 'col-md-4')}${crCampoTxt('Vulnerabilidades', 'vulnerabilidades', 'col-md-4')}
    </div></div>
    <div class="folha mt-2"><h2>Atributos</h2><div class="row g-2">${CR.atributos.map(([k, n]) => `<div class="col-4 col-md-2"><label class="rotulo">${n}</label><input type="number" class="form-control" data-cn="atr.${k}" value="${esc(P.atr[k])}"><div class="rotulo">bônus <b data-cr="b:${k}"></b> <small>(inclui ½ nível)</small></div></div>`).join('')}</div>
      <div class="row g-2 mt-1">${crCampoTxt('Perícias (ex.: Stealth +10, Thievery +10)', 'pericias', 'col-md-6')}${crCampoTxt('Equipamento', 'equipamento', 'col-md-6')}
      ${crCampoTxt('Descrição / aparência', 'descricao', 'col-md-6', true)}${crCampoTxt('Táticas e anotações de combate', 'taticas', 'col-md-6', true)}</div></div>`;
  crLigar(c);
  $('#cr-auto').onclick = () => crAplicarSugestao(false);
  $('#cr-auto-atr').onclick = async () => { const r = await api('/api/criatura/sugerir', { method: 'POST', body: { criatura: P } }); P.atr = r.atributos; agendarSalvar(); abaEstatCriatura(c); crDerivar(); toast('Atributos sugeridos aplicados (mesma função e nível sempre dá o mesmo resultado).'); };
  crDerivar();
}

function cartaoPoder(p, i) {
  const rec = p.uso === 'recharge';
  return `<details class="folha cr-poder mb-2" ${p._aberto ? 'open' : ''} data-i="${i}"><summary><span class="tag ${p.uso || 'rasgo'}">${esc((CR.categorias.find((x) => x[0] === p.categoria) || [, ''])[1].replace(/ \(.*\)/, ''))}</span>
      <b>${esc(p.nome)}</b> <small>${esc([(CR.usos.find((u) => u[0] === p.uso) || [, ''])[1] !== '—' && (CR.usos.find((u) => u[0] === p.uso) || [, ''])[1], p.ataque ? `+${p.ataque.bonus} vs ${p.ataque.defesa}` : '', p.dano].filter(Boolean).join(' · '))}</small>
      <span class="ms-auto d-inline-flex gap-1"><button type="button" class="btn-macro" data-cmacro="${esc(p.id)}" title="Copiar macro do Roll20">R20</button></span></summary>
    <div class="row g-2 mt-1">
      <div class="col-md-5"><label class="rotulo">Nome</label><input class="form-control" data-pt="${i}.nome" value="${esc(p.nome)}"></div>
      <div class="col-md-4"><label class="rotulo">Tipo de ação</label><select class="form-select" data-ps="${i}.categoria">${crOpt(CR.categorias, p.categoria)}</select></div>
      <div class="col-md-3"><label class="rotulo">Uso</label><select class="form-select" data-ps="${i}.uso">${crOpt(CR.usos, p.uso)}</select></div>
      ${rec ? `<div class="col-md-3"><label class="rotulo">Recarrega com</label><select class="form-select" data-ps="${i}.recarga">${crOpt([['6', '6'], ['5', '5-6'], ['4', '4-6'], ['3', '3-6'], ['sangrando', 'quando sangrando']], p.recarga)}</select></div>` : ''}
      ${p.categoria === 'gatilho' || p.acao ? `<div class="col-md-4"><label class="rotulo">Quando usa</label><select class="form-select" data-ps="${i}.acao">${crOpt(CR.acoes, p.acao || 'immediate reaction')}</select></div>` : ''}
      <div class="col-md-4"><label class="rotulo">Palavras-chave (fire, weapon, fear…)</label><input class="form-control" data-pt="${i}.palavras" value="${esc(p.palavras)}"></div>
      <div class="col-md-4"><label class="rotulo">Alcance (Melee 1, Ranged 10, Close burst 3…)</label><input class="form-control" data-pt="${i}.alcance" value="${esc(p.alcance)}"></div>
      <div class="col-md-4"><label class="rotulo">Alvo</label><input class="form-control" data-pt="${i}.alvo" value="${esc(p.alvo)}"></div>
      <div class="col-6 col-md-2"><label class="rotulo">Ataque?</label><div><input type="checkbox" data-pk="${i}.temAtaque" ${p.ataque ? 'checked' : ''}> bônus</div></div>
      ${p.ataque ? `<div class="col-6 col-md-2"><label class="rotulo">Bônus</label><input type="number" class="form-control" data-pn="${i}.ataque.bonus" value="${esc(p.ataque.bonus)}"></div>
      <div class="col-6 col-md-2"><label class="rotulo">Contra</label><select class="form-select" data-ps="${i}.ataque.defesa">${crOpt(CR.defesas.map((d) => [d, d]), p.ataque.defesa)}</select></div>` : ''}
      <div class="col-md-4"><label class="rotulo">Dano (ex.: 2d8 + 7)</label><input class="form-control" data-pt="${i}.dano" value="${esc(p.dano)}"></div>
      <div class="col-md-6"><label class="rotulo">Acerto (texto)</label><textarea class="form-control" rows="2" data-pt="${i}.acerto">${esc(p.acerto)}</textarea></div>
      <div class="col-md-6"><label class="rotulo">Erro</label><textarea class="form-control" rows="2" data-pt="${i}.erro">${esc(p.erro)}</textarea></div>
      <div class="col-md-6"><label class="rotulo">Efeito</label><textarea class="form-control" rows="2" data-pt="${i}.efeito">${esc(p.efeito)}</textarea></div>
      <div class="col-md-3"><label class="rotulo">Gatilho</label><textarea class="form-control" rows="2" data-pt="${i}.gatilho">${esc(p.gatilho)}</textarea></div>
      <div class="col-md-3"><label class="rotulo">Requisito / Especial</label><textarea class="form-control" rows="2" data-pt="${i}.requisito" placeholder="Requisito">${esc(p.requisito)}</textarea></div>
      <div class="col-12"><label class="rotulo">Especial</label><input class="form-control" data-pt="${i}.especial" value="${esc(p.especial)}"></div>
      ${(p.extras || []).map((e, j) => `<div class="col-12"><label class="rotulo">${esc(e.rotulo)}</label><textarea class="form-control" rows="2" data-pt="${i}.extras.${j}.texto">${esc(e.texto)}</textarea></div>`).join('')}
    </div>
    <div class="d-flex gap-2 mt-2 flex-wrap"><button class="btn-rpg-sec btn-sm" data-sug="${i}" title="Preenche bônus de ataque e dano pelo nível e uso, como nos monstros do compêndio">✨ Sugerir ataque e dano</button>
      <button class="btn-rpg-mini" data-dup="${i}">Duplicar</button><button class="btn-rpg-mini" data-del="${i}">🗑 Excluir</button></div></details>`;
}

function abaPoderesCriatura(c) {
  c.innerHTML = `<div class="folha"><div class="d-flex gap-2 flex-wrap align-items-center mb-2"><h2 class="flex-grow-1 mb-0">Poderes e características</h2>
      <button class="btn-rpg" id="cr-novo-poder">＋ Novo poder</button><button class="btn-rpg-sec" id="cr-ajustar" title="Recalcula bônus de ataque e dano de todos os poderes pelo nível, função e uso atuais">🎚 Ajustar todos ao nível</button><button class="btn-rpg-sec" id="cr-add-comp" title="Copia todos os poderes de um monstro do compêndio; apague os que não quiser">📖 Copiar poderes de outro monstro</button><button class="btn-rpg-sec" id="cr-retalhos" title="Escolha poder a poder, de vários monstros diferentes, filtrando por faixa de dano ou característica">🧩 Colcha de retalhos</button></div>
    <p class="text-muted mb-2">Cada poder tem o botão <b>R20</b> que copia a macro do Roll20 com o ataque e o dano já calculados. ✨ preenche bônus e dano pelo nível.</p>
    <div id="cr-lista">${P.poderes.length ? P.poderes.map(cartaoPoder).join('') : '<p class="text-muted">Nenhum poder ainda. Crie um ou copie de outro monstro.</p>'}</div></div>`;
  const religar = () => {
    $$('[data-pt]', c).forEach((i) => i.oninput = () => { crPoderSet(i.dataset.pt, i.value); });
    $$('[data-pn]', c).forEach((i) => i.oninput = () => { crPoderSet(i.dataset.pn, i.value === '' ? '' : +i.value); });
    $$('[data-ps]', c).forEach((i) => i.onchange = () => { crPoderSet(i.dataset.ps, i.value); if (/\.(categoria|uso)$/.test(i.dataset.ps)) { abrirManter(); } });
    $$('[data-pk]', c).forEach((i) => i.onchange = () => { const [n] = i.dataset.pk.split('.'); const p = P.poderes[+n]; p.ataque = i.checked ? (p.ataque || { bonus: (+P.nivel || 1) + 5, defesa: 'AC' }) : null; crMudou(); abrirManter(); });
    $$('[data-sug]', c).forEach((b) => b.onclick = async () => {
      const p = P.poderes[+b.dataset.sug];
      const r = await api('/api/criatura/sugerir', { method: 'POST', body: { criatura: P, poder: p } });
      if (r.ataque) p.ataque = r.ataque; if (r.dano) p.dano = r.dano; crMudou(); abrirManter();
    });
    $$('[data-dup]', c).forEach((b) => b.onclick = () => { const p = JSON.parse(JSON.stringify(P.poderes[+b.dataset.dup])); p.id = uid(); p.nome += ' (cópia)'; P.poderes.splice(+b.dataset.dup + 1, 0, p); crMudou(); abaPoderesCriatura(c); });
    $$('[data-del]', c).forEach((b) => b.onclick = () => { const p = P.poderes[+b.dataset.del]; if (!confirm(`Excluir "${p.nome}"?`)) return; P.poderes.splice(+b.dataset.del, 1); crMudou(); abaPoderesCriatura(c); });
  };
  const abrirManter = () => { $$('details.cr-poder', c).forEach((d) => { P.poderes[+d.dataset.i]._aberto = d.open; }); abaPoderesCriatura(c); };
  religar();
  $('#cr-novo-poder').onclick = () => { const p = { id: uid(), nome: 'Novo poder', categoria: 'padrao', uso: 'at-will', recarga: '', simbolo: '', palavras: '', gatilho: '', requisito: '', alcance: 'Melee 1', alvo: 'one creature', ataque: { bonus: (+P.nivel || 1) + 5, defesa: 'AC' }, dano: '', acerto: '', erro: '', efeito: '', especial: '', extras: [], _aberto: true };
    P.poderes.push(p); api('/api/criatura/sugerir', { method: 'POST', body: { criatura: P, poder: p } }).then((r) => { p.dano = r.dano; crMudou(); abaPoderesCriatura(c); }); };
  $('#cr-ajustar').onclick = async () => {
    if (!confirm('Recalcular ataque e dano de todos os poderes com ataque ou dano para o nível ' + P.nivel + '?')) return;
    for (const p of P.poderes) { if (!p.ataque && !p.dano) continue; const r = await api('/api/criatura/sugerir', { method: 'POST', body: { criatura: P, poder: p } }); if (r.ataque) p.ataque = r.ataque; if (r.dano) p.dano = r.dano; }
    crMudou(); abaPoderesCriatura(c); toast('Poderes ajustados ao nível ' + P.nivel + '.');
  };
  $('#cr-add-comp').onclick = () => escolher({ cats: ['monster'], titulo: 'Copiar os poderes de qual monstro?', filtros: { nivelMax: '' }, onPick: async (m) => {
    const o = await api('/api/criatura/modelo?id=' + m.ID);
    for (const p of o.poderes) { p.id = uid(); P.poderes.push(p); }
    toast(`${o.poderes.length} poderes copiados de ${esc(o.nome)}. Ajuste os números ao nível da sua criatura.`, false, 6000);
    crMudou(); abaPoderesCriatura(c);
  } });
  $('#cr-retalhos').onclick = () => abrirColchaRetalhos(c);
}

// "Colcha de retalhos": escolhe poder a poder (não o monstro inteiro), de vários monstros, filtrando por faixa de
// dano (baixo/médio/alto, comparado à tabela do nível do monstro-fonte) ou por característica (traço, sem dano).
const CR_FAIXAS = [['', 'Qualquer dano'], ['baixo', 'Dano baixo'], ['medio', 'Dano médio'], ['alto', 'Dano alto'], ['traco', 'Traços (sem dano)']];
function abrirColchaRetalhos(c) {
  const f = { q: '', tipo: '', nivelMax: '' };
  const marcados = new Map(); // key = monstroId+'#'+poder.nome -> item do índice
  $('#pk-titulo').textContent = '🧩 Colcha de retalhos: escolha poderes de vários monstros';
  let itens = [];
  $('#pk-filtros').innerHTML = `
    <div class="col-md-4"><input class="form-control" id="pk-q" placeholder="Nome do poder, do monstro ou texto…"></div>
    <div class="col-md-4"><select class="form-select" id="pk-tipo">${CR_FAIXAS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div>
    <div class="col-md-3"><input class="form-control" id="pk-nv" type="number" min="0" max="35" placeholder="Nível máx. do monstro-fonte"></div>`;
  $('#pk-q').oninput = (e) => { f.q = e.target.value; buscar(); };
  $('#pk-tipo').onchange = (e) => { f.tipo = e.target.value; buscar(); };
  $('#pk-nv').oninput = (e) => { f.nivelMax = e.target.value; buscar(); };
  const chave = (x) => x.monstroId + '#' + x.poder.nome;
  const atualizarBarra = () => {
    $('#pk-rodape-multi').textContent = marcados.size ? `${marcados.size} poder(es) selecionado(s).` : 'Marque quantos quiser, pesquisando à vontade.';
    $('#pk-ok-multi').disabled = !marcados.size;
    $('#pk-ok-multi').textContent = `✅ Carregar ${marcados.size} poder(es)`;
  };
  $('#pk-acoes').innerHTML = `<div class="d-flex justify-content-between align-items-center gap-2 flex-wrap"><span class="rotulo" id="pk-rodape-multi"></span><button class="btn-rpg" id="pk-ok-multi" disabled>✅ Carregar 0 poder(es)</button></div>`;
  $('#pk-ok-multi').onclick = () => {
    for (const x of marcados.values()) { const p = JSON.parse(JSON.stringify(x.poder)); p.id = uid(); P.poderes.push(p); }
    toast(`${marcados.size} poder(es) adicionado(s). Ajuste os números ao nível da sua criatura (✨ ou 🎚).`, false, 7000);
    crMudou(); abaPoderesCriatura(c); modal('modalPicker').hide();
  };
  const previa = (x) => `<div class="folha"><h3>${esc(x.poder.nome)}</h3><p class="text-muted">${esc(x.monstro)} · nível ${x.nivel} · ${esc(resumoFaixa(x.faixa))}</p>
    ${x.poder.palavras ? `<p><i>${esc(x.poder.palavras)}</i></p>` : ''}${x.poder.alcance ? `<p><b>Alcance:</b> ${esc(x.poder.alcance)}</p>` : ''}
    ${x.poder.acerto ? `<p><b>Acerto:</b> ${esc(x.poder.acerto)}</p>` : ''}${x.poder.efeito ? `<p><b>Efeito:</b> ${esc(x.poder.efeito)}</p>` : ''}
    ${x.poder.erro ? `<p><b>Erro:</b> ${esc(x.poder.erro)}</p>` : ''}</div>`;
  let t;
  const buscar = () => { clearTimeout(t); t = setTimeout(rodar, 220); };
  const rodar = async () => {
    const qs = new URLSearchParams({ limite: 150 }); for (const k of ['q', 'tipo', 'nivelMax']) if (f[k]) qs.set(k, f[k]);
    const r = await api('/api/criatura/poderes-busca?' + qs); itens = r.itens;
    $('#pk-lista').innerHTML = `<table class="res-tab"><thead><tr><th></th><th>Poder</th><th>Monstro</th><th>Nível</th><th>Faixa</th></tr></thead><tbody>${itens.map((x, i) =>
      `<tr data-i="${i}" class="${marcados.has(chave(x)) ? 'sel' : ''}"><td><input type="checkbox" class="form-check-input" ${marcados.has(chave(x)) ? 'checked' : ''}></td><td><b>${esc(x.poder.nome)}</b></td><td>${esc(x.monstro)}</td><td>${x.nivel}</td><td>${esc(resumoFaixa(x.faixa))}</td></tr>`).join('')}</tbody></table>`;
    $('#pk-rodape').textContent = r.total > itens.length ? `Mostrando ${itens.length} de ${r.total}. Refine a busca.` : `${r.total} resultado(s).`;
    $$('#pk-lista tbody tr').forEach((tr) => tr.onclick = () => {
      const x = itens[+tr.dataset.i]; const k = chave(x);
      if (marcados.has(k)) marcados.delete(k); else marcados.set(k, x);
      tr.classList.toggle('sel', marcados.has(k)); $('input[type=checkbox]', tr).checked = marcados.has(k);
      atualizarBarra(); $('#pk-previa').innerHTML = previa(x);
    });
  };
  pickerRefresh = rodar;
  $('#pk-previa').innerHTML = '<p class="text-muted">Clique num poder pra marcar e ver o texto completo.</p>';
  atualizarBarra(); rodar();
  modal('modalPicker').show();
  setTimeout(() => $('#pk-q')?.focus(), 400);
}
function resumoFaixa(f) { return { baixo: 'dano baixo', medio: 'dano médio', alto: 'dano alto', traco: 'traço', '': '—' }[f] || f; }
function crPoderSet(caminho, valor) {
  const ps = caminho.split('.'); const p = P.poderes[+ps.shift()]; let o = p;
  while (ps.length > 1) o = o[ps.shift()];
  o[ps[0]] = valor;
  if (caminho.endsWith('.categoria')) p.acao = valor === 'gatilho' ? (p.acao || 'immediate reaction') : '';
  crMudou();
}

function abaBlocoCriatura(c) {
  c.innerHTML = `<div class="folha"><div class="d-flex gap-2 flex-wrap mb-2"><h2 class="flex-grow-1 mb-0">Bloco de estatísticas</h2>
    <button class="btn-rpg-sec" id="cr-imprimir">🖨 Imprimir / salvar PDF</button></div><div id="cr-bloco">${CR_BLOCO}</div></div>`;
  $('#cr-imprimir').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return toast('O navegador bloqueou a janela. Permita pop-ups para imprimir.', true);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(P.nome)}</title><style>body{font-family:Georgia,serif;margin:18px;color:#222}${CR_CSS_IMPRESSAO}</style>${CR_BLOCO}<script>setTimeout(()=>print(),300)<\/script>`); w.document.close();
  };
  crDerivar();
}
const CR_CSS_IMPRESSAO = '.sb{max-width:760px;border:2px solid #222}.sb-h{display:flex;justify-content:space-between;gap:10px;background:#5a1111;color:#fff;margin:0;padding:6px 10px;font-size:18px}.sb-nv,.sb-xp{font-size:13px;font-weight:400}.sb-tipo{padding:3px 10px;background:#eee;font-style:italic}.sb-tab{width:100%;border-collapse:collapse}.sb-tab td{padding:3px 10px;border-bottom:1px solid #ccc}.dir{text-align:right}.sb h2{margin:0;background:#8e1b1b;color:#fff;font-size:13px;padding:2px 10px;text-transform:uppercase}.sb-poder{padding:3px 10px;border-bottom:1px solid #ddd}.sb-poder p{margin:2px 0;font-size:13px}.sb-cab{background:#f1e3c4;padding:2px 4px}.sb-rodape{padding:4px 10px;font-size:13px;background:#f6efdc}';

// Botão R20 dos poderes da criatura (as macros já vêm calculadas pelo servidor)
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cmacro]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const m = CR_MACROS[b.dataset.cmacro];
  if (!m) { await crDerivar(); }
  const txt = CR_MACROS[b.dataset.cmacro];
  if (!txt) return toast('Não consegui gerar a macro.', true);
  await copiarTexto(txt);
  b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 1500);
  toast('Macro do Roll20 copiada. Cole no chat do Roll20.');
}, true);
