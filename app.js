// Grimório do Aventureiro — front-end (JavaScript simples, sem build).
'use strict';

// ============================================================ utilidades
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const dataBR = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } };
const po = (n) => Number(n || 0).toLocaleString('pt-BR');

async function api(url, opts = {}) {
  const o = { ...opts };
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers = { 'Content-Type': 'application/json' }; }
  const r = await fetch(url, o);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) throw new Error(j.erro || `Erro ${r.status}`);
  return j;
}
function toast(msg, erro = false, ms = 4500) {
  const d = document.createElement('div');
  d.className = 'toast-rpg' + (erro ? ' err' : '');
  d.innerHTML = msg;
  $('#toasts').append(d);
  setTimeout(() => d.remove(), ms);
}
const modal = (id) => bootstrap.Modal.getOrCreateInstance(document.getElementById(id));

// Campos de texto de uma linha (idiomas, traços, resistências, equipamento…) viram caixas que CRESCEM com o texto
// e ganham barra de rolagem quando passam do limite, em todo o app. A troca acontece logo depois de qualquer
// innerHTML/insertAdjacentHTML, antes de os campos serem ligados aos dados (textarea também usa .value e oninput).
const SELETOR_TEXTO = 'input[data-bind], input[data-ct], input[data-pt]';
function crescerCampo(t) {
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight + 2, 150) + 'px';
}
function upgradeCampos(raiz) {
  if (!raiz || !raiz.querySelectorAll) return;
  for (const i of raiz.querySelectorAll(SELETOR_TEXTO)) {
    if (i.closest('#topo') || i.hasAttribute('list') || !['', 'text', 'search'].includes(i.getAttribute('type') || '')) continue;
    const t = document.createElement('textarea');
    for (const a of i.attributes) if (a.name !== 'type' && a.name !== 'value') t.setAttribute(a.name, a.value);
    t.rows = 1; t.value = i.getAttribute('value') ?? '';
    t.classList.add('campo-auto');
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); }); // continua sendo um campo de uma linha lógica
    t.addEventListener('input', () => crescerCampo(t));
    i.replaceWith(t);
    requestAnimationFrame(() => { crescerCampo(t); setTimeout(() => crescerCampo(t), 120); });
  }
}
for (const [Cls, nome] of [[Element, 'innerHTML']]) {
  const d = Object.getOwnPropertyDescriptor(Cls.prototype, nome);
  Object.defineProperty(Cls.prototype, nome, { ...d, set(v) { d.set.call(this, v); upgradeCampos(this); } });
}
const _iah = Element.prototype.insertAdjacentHTML;
Element.prototype.insertAdjacentHTML = function (pos, html) { _iah.call(this, pos, html); upgradeCampos(pos === 'beforebegin' || pos === 'afterend' ? this.parentElement : this); };
addEventListener('resize', () => $$('.campo-auto').forEach(crescerCampo));

const ATRS = [['for', 'Força', 'FOR'], ['con', 'Constituição', 'CON'], ['des', 'Destreza', 'DES'], ['int', 'Inteligência', 'INT'], ['sab', 'Sabedoria', 'SAB'], ['car', 'Carisma', 'CAR']];
const PERICIAS = [['Acrobatics', 'Acrobacia', 'des'], ['Arcana', 'Arcanismo', 'int'], ['Athletics', 'Atletismo', 'for'], ['Bluff', 'Blefar', 'car'],
  ['Diplomacy', 'Diplomacia', 'car'], ['Dungeoneering', 'Exploração', 'sab'], ['Endurance', 'Resistência', 'con'], ['Heal', 'Cura', 'sab'],
  ['History', 'História', 'int'], ['Insight', 'Intuição', 'sab'], ['Intimidate', 'Intimidação', 'car'], ['Nature', 'Natureza', 'sab'],
  ['Perception', 'Percepção', 'sab'], ['Religion', 'Religião', 'int'], ['Stealth', 'Furtividade', 'des'], ['Streetwise', 'Manha', 'car'], ['Thievery', 'Ladinagem', 'des']];
const ESCOLHAS = [['raca', 'race', 'Raça'], ['classe', 'class', 'Classe'], ['paragon', 'paragonpath', 'Trilha exemplar'], ['destino', 'epicdestiny', 'Destino épico'],
  ['tema', 'theme', 'Tema'], ['antecedente', 'background', 'Antecedente'], ['divindade', 'deity', 'Divindade']];
const NIVEIS_AUMENTO = [4, 8, 14, 18, 24, 28];
const sinal = (n) => (n >= 0 ? '+' : '') + n;
const NOME_CAT = { monster: 'Monstro', trap: 'Armadilha', class: 'Classe', race: 'Raça', power: 'Poder', feat: 'Talento', item: 'Item mágico', weapon: 'Arma', armor: 'Armadura', implement: 'Implemento', background: 'Antecedente', theme: 'Tema',
  paragonpath: 'Trilha exemplar', epicdestiny: 'Destino épico', deity: 'Divindade', ritual: 'Ritual', glossary: 'Glossário', companion: 'Companheiro', disease: 'Doença', poison: 'Veneno' };

// idioma dos textos do compêndio (o nome sempre mostra o original com a tradução entre parênteses)
let IDIOMA = localStorage.getItem('idioma') || 'pt';
function ligarIdioma() {
  const b = $('#btn-idioma');
  b.textContent = IDIOMA === 'pt' ? '🌐 Português' : '🌐 English';
  b.onclick = () => { IDIOMA = IDIOMA === 'pt' ? 'en' : 'pt'; localStorage.setItem('idioma', IDIOMA); ligarIdioma(); redesenharTextos(); };
}
function redesenharTextos() {
  if ($('#grimorio.show') || document.body.classList.contains('gr-pagina')) desenharGrimorio();
  if ($('#modalLeitor.show') && leitorAtual) abrirLeitor(leitorAtual.cat, leitorAtual.id);
  if ($('#modalPicker.show') && pickerRefresh) pickerRefresh();
}

// ============================================================ estado
let P = null;            // personagem aberto
let CALC = null;         // resultado do cálculo automático
let aba = sessionStorage.getItem('aba') || 'ficha';
let salvarTimer = null, calcTimer = null;

function definir(obj, caminho, valor) {
  const ps = caminho.split('.');
  let o = obj;
  while (ps.length > 1) { const k = ps.shift(); o[k] = o[k] ?? {}; o = o[k]; }
  o[ps[0]] = valor;
}
const ler = (caminho) => caminho.split('.').reduce((o, k) => o?.[k], P);
function log(tipo, texto) { P.historico.push({ quando: new Date().toISOString(), tipo, texto }); }

function agendarSalvar() {
  setStatus('Alterado…');
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(salvarAgora, 400);
}
async function salvarAgora() {
  if (!P) return;
  clearTimeout(salvarTimer);
  try { const r = await api('/api/personagens/' + P.id, { method: 'PUT', body: P }); P.atualizado = r.atualizado; setStatus('Salvo ✓ ' + dataBR(r.atualizado)); }
  catch (e) { setStatus('⚠ NÃO SALVO — clique em Salvar'); toast('Não consegui salvar: ' + esc(e.message), true); clearTimeout(salvarTimer); salvarTimer = setTimeout(salvarAgora, 5000); }
}
// grava na hora quando a aba perde o foco ou fecha (keepalive termina mesmo com a página fechando)
function salvarSaindo() { if (P && !GRIM_ID) fetch('/api/personagens/' + P.id, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) }).catch(() => {}); }
addEventListener('pagehide', salvarSaindo);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salvarSaindo(); });
function setStatus(t) { const e = $('#status-salvo'); if (e) e.textContent = t; }

// ============================================================ cálculo automático (regras do Character Builder, no servidor)
function recalcular(imediato) {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(async () => {
    if (!P) return;
    try {
      CALC = await api('/api/calcular', { method: 'POST', body: { ...P, retrato: null, notas: [], historico: [] } });
      // guarda um resumo na ficha (aparece na lista de personagens e se o servidor falhar)
      P.atributos = CALC.atributos; P.defesas = { ca: CALC.ac, fort: CALC.fort, ref: CALC.ref, vont: CALC.vont };
      P.pv = CALC.pv; P.surtos = CALC.surtos; P.velocidade = CALC.velocidade;
      aplicarCalculo();
    } catch (e) { toast('Cálculo: ' + esc(e.message), true); }
  }, imediato ? 0 : 150);
}
const dica = (lista) => (lista || []).map((o) => `${o.fonte}: ${o.valor >= 0 ? '+' : ''}${o.valor}${o.tipo ? ' (' + o.tipo + ')' : ''}${o.aplicado === false ? ' — não soma (mesmo tipo)' : ''}`).join('\n');
function aplicarCalculo() {
  if (!CALC) return;
  const C = CALC;
  const set = (k, v, titulo) => $$(`[data-calc="${k}"]`).forEach((e) => { e.textContent = v; if (titulo !== undefined) e.title = titulo; });
  ATRS.forEach(([k]) => { set('atr:' + k, C.atributos[k]); set('mod:' + k, sinal(C.modificadores[k])); set('niv:' + k, sinal(C.detalheAtributos[k].niveis)); });
  set('ac', C.ac, dica(C.origem.ac)); set('fort', C.fort, dica(C.origem.fort)); set('ref', C.ref, dica(C.origem.ref)); set('vont', C.vont, dica(C.origem.vont));
  set('pv', C.pv, dica(C.origem.pv)); set('surtos', C.surtos); set('valorsurto', C.valorSurto);
  set('vel', C.velocidade, dica(C.origem.velocidade)); set('ini', sinal(C.iniciativa), dica(C.origem.iniciativa));
  set('sangrando', Math.floor(C.pv / 2)); set('meio', Math.floor(C.nivel / 2)); set('penal', C.penalidadeArmadura);
  PERICIAS.forEach(([n]) => set('per:' + n, sinal(C.pericias[n])));
  set('passiva:Perception', 10 + C.pericias.Perception); set('passiva:Insight', 10 + C.pericias.Insight);
  const b = $('#barra-pv'); if (b) b.style.width = Math.max(0, Math.min(100, ((+P.pvAtual || 0) / (C.pv || 1)) * 100)) + '%';
  const av = $('#painel-avisos');
  if (av) av.innerHTML = C.avisos.length ? C.avisos.map((a) => `<div class="aviso">⚠ ${esc(a)}</div>`).join('') : '';
  const at = $('#painel-ataques');
  if (at) at.innerHTML = C.ataques.length ? `<table class="tabela-per"><tr><th>Arma equipada</th><th>Ataque</th><th>Dano</th></tr>${C.ataques.map((x) =>
    `<tr><td><b>${esc(x.nome)}</b> <small>${esc(x.grupo)}${x.mais ? ' · +' + x.mais : ''}</small></td><td>${sinal(x.ataque)} <small>(${x.atributo.toUpperCase()}${x.alternativo ? ' / ' + x.alternativo.atributo.toUpperCase() + ' ' + sinal(x.alternativo.ataque) : ''})</small></td><td>${esc(x.dano)}${x.danoBonus ? sinal(x.danoBonus) : ''}</td></tr>`).join('')}</table>` : '<p class="text-muted mb-0">Equipe uma arma no inventário para ver ataque e dano.</p>';
  const gasto = $('#ouro-gasto'); if (gasto) gasto.textContent = po(C.gastos);
}

// ============================================================ pesquisa global
let buscaT;
$('#busca-global').addEventListener('input', (e) => {
  clearTimeout(buscaT);
  const q = e.target.value.trim();
  const caixa = $('#res-global');
  if (q.length < 2) { caixa.classList.add('invisivel'); return; }
  buscaT = setTimeout(async () => {
    try {
      const r = await api('/api/comp/global?q=' + encodeURIComponent(q));
      caixa.innerHTML = r.length ? r.map((x) => `<div data-cat="${x.cat}" data-id="${x.id}"><span class="cat">${esc(NOME_CAT[x.cat] || x.cat)}</span><span>${esc(x.nome)}${x.pt ? ` <span class="pt-nome">(${esc(x.pt)})</span>` : ''}</span><span class="inf">${esc((x.nivel ? 'nív. ' + x.nivel + ' · ' : '') + x.info)}</span></div>`).join('') : '<div>Nada encontrado.</div>';
      caixa.classList.remove('invisivel');
    } catch (err) { toast(esc(err.message), true); }
  }, 250);
});
$('#res-global').addEventListener('click', (e) => { const d = e.target.closest('[data-id]'); if (d) { abrirLeitor(d.dataset.cat, d.dataset.id); $('#res-global').classList.add('invisivel'); } });
document.addEventListener('click', (e) => { if (!e.target.closest('#res-global, #busca-global')) $('#res-global').classList.add('invisivel'); });
$('#marca').onclick = () => irParaHome();

// ============================================================ compêndio: cartas
const detCache = new Map();
function getDet(cat, id) {
  const k = cat + ':' + id;
  if (!detCache.has(k)) detCache.set(k, api(`/api/comp/item?cat=${cat}&id=${encodeURIComponent(id)}`).catch((e) => { detCache.delete(k); throw e; }));
  return detCache.get(k);
}
// Carta: nome original + (tradução); corpo no idioma escolhido (se não houver tradução, mostra o original).
// Se esta ficha tiver um "reskin"/hotfix salvo para este poder/talento/item (P.poderOverrides), mostra o texto editado em vez do compêndio.
function htmlCarta(det) {
  const over = P?.poderOverrides?.[det.cat + ':' + det.id];
  if (over) return htmlCartaOverride(over, det);
  const mo = /^\s*(<h1[^>]*>)([^<]*)([\s\S]*?<\/h1>)([\s\S]*)$/i.exec(det.html);
  if (!mo) return `<div class="carta"><div class="corpo">${det.html}</div></div>`;
  const usaPT = IDIOMA === 'pt' && det.htmlPT;
  const mp = usaPT ? /^\s*(<h1[^>]*>)([^<]*)([\s\S]*?<\/h1>)([\s\S]*)$/i.exec(det.htmlPT) : null;
  const pt = det.nomePT && det.nomePT.toLowerCase() !== mo[2].trim().toLowerCase() ? ` <span class="pt">(${esc(det.nomePT)})</span>` : '';
  const idMacro = det.macro && det.meta?.ID ? det.meta.ID : '';
  const topo = `${mo[1]}<span>${mo[2]}${pt}</span>${(mp ? mp[3] : mo[3]).replace(/<\/h1>\s*$/i, `${idMacro ? btnMacro(idMacro) : ''}</h1>`)}`;
  const parcial = usaPT && det.cobertura < 0.98 ? `<div class="rotulo">tradução parcial (${Math.round(det.cobertura * 100)}%)</div>` : '';
  return `<div class="carta">${topo}<div class="corpo">${parcial}${mp ? mp[4] : mo[4]}</div></div>`;
}
function htmlCartaOverride(o, det) {
  const idMacro = det.macro && det.id ? det.id : '';
  const cab = [o.tipo, (o.palavras || []).join(', ')].filter(Boolean).join(' · ');
  const acaoAlcance = [o.acao, o.alcance].filter(Boolean).join(' — ');
  return `<div class="carta"><h1><span>${esc(o.nome)} <span class="tag" title="Texto editado nesta ficha (reskin/hotfix); o original do compêndio continua intacto">✏ editado</span></span>${idMacro ? btnMacro(idMacro) : ''}</h1>
    <div class="corpo">${cab ? `<p><i>${esc(cab)}</i></p>` : ''}${acaoAlcance ? `<p>${esc(acaoAlcance)}</p>` : ''}
    ${(o.campos || []).map((cp) => `<p><b>${esc(cp.rotulo)}:</b> ${esc(cp.texto).replace(/\n/g, '<br>')}</p>`).join('')}</div></div>`;
}
// Editor de reskin/hotfix: edita nome, tipo, ação, alcance, palavras-chave e cada campo (Attack/Hit/Effect…) deste
// poder/talento/item NESTA FICHA, sem alterar o compêndio nem outras fichas. "Restaurar original" apaga a edição.
async function abrirEditorPoder(cat, id) {
  const det = await getDet(cat, id);
  const chave = cat + ':' + id;
  let o = P.poderOverrides[chave];
  if (!o) { const base = await api(`/api/comp/estrutura?cat=${cat}&id=${encodeURIComponent(id)}&lang=${IDIOMA}`); o = { nome: base.nome, tipo: base.tipo, palavras: base.palavras, acao: base.acao, alcance: base.alcance, campos: base.campos.map((c) => ({ ...c })) }; }
  $('#leitor').innerHTML = `<h3>✏ Editar (só nesta ficha)</h3><p class="text-muted">Reskin (trocar nome/tema) ou hotfix (corrigir um número/texto). O original do compêndio não muda, e isto não afeta outras fichas.</p>
    <div class="row g-2"><div class="col-md-6"><label class="rotulo">Nome</label><input class="form-control" id="ed-nome" value="${esc(o.nome)}"></div>
    <div class="col-md-3"><label class="rotulo">Tipo/uso</label><input class="form-control" id="ed-tipo" value="${esc(o.tipo || '')}"></div>
    <div class="col-md-3"><label class="rotulo">Ação</label><input class="form-control" id="ed-acao" value="${esc(o.acao || '')}"></div>
    <div class="col-md-6"><label class="rotulo">Palavras-chave (separe por vírgula)</label><input class="form-control" id="ed-palavras" value="${esc((o.palavras || []).join(', '))}"></div>
    <div class="col-md-6"><label class="rotulo">Alcance/alvo</label><input class="form-control" id="ed-alcance" value="${esc(o.alcance || '')}"></div></div>
    <div id="ed-campos" class="mt-2">${o.campos.map((c, i) => `<div class="row g-2 mb-1"><div class="col-3"><input class="form-control" data-rot="${i}" value="${esc(c.rotulo)}"></div><div class="col-9"><textarea class="form-control" rows="2" data-txt="${i}">${esc(c.texto)}</textarea></div></div>`).join('')}</div>
    <button class="btn-rpg-mini" id="ed-add-campo">＋ Campo</button>
    <div class="d-flex justify-content-between mt-3"><button class="btn-rpg-mini" id="ed-restaurar">↺ Restaurar original</button>
    <div><button class="btn-rpg-mini" id="ed-cancel">Cancelar</button> <button class="btn-rpg" id="ed-ok">💾 Salvar (só nesta ficha)</button></div></div>`;
  modal('modalLeitor').show();
  const coletar = () => {
    const campos = $$('#ed-campos [data-rot]').map((inp, i) => ({ rotulo: inp.value, texto: $(`[data-txt="${i}"]`).value }));
    return { nome: $('#ed-nome').value || o.nome, tipo: $('#ed-tipo').value, acao: $('#ed-acao').value, alcance: $('#ed-alcance').value, palavras: $('#ed-palavras').value.split(',').map((s) => s.trim()).filter(Boolean), campos };
  };
  $('#ed-add-campo').onclick = () => { P.poderOverrides[chave] = coletar(); P.poderOverrides[chave].campos.push({ rotulo: 'Efeito', texto: '' }); abrirEditorPoder(cat, id); };
  $('#ed-cancel').onclick = () => modal('modalLeitor').hide();
  $('#ed-restaurar').onclick = () => { delete P.poderOverrides[chave]; agendarSalvar(); toast('Restaurado ao original do compêndio.'); modal('modalLeitor').hide(); desenharFicha(); };
  $('#ed-ok').onclick = () => { P.poderOverrides[chave] = coletar(); agendarSalvar(); toast('Edição salva nesta ficha.'); modal('modalLeitor').hide(); desenharFicha(); };
}

// Botão discreto "R20": copia a macro do Roll20 (template dnd4epower) de poder, talento ou item mágico.
// O id do compêndio já diz a categoria (power123, feat45, item9, weapon7...). Itens com propriedade e poderes
// têm várias macros: o clique abre um menuzinho para escolher qual copiar.
const btnMacro = (id) => `<button type="button" class="btn-macro" data-macro="${id}" title="Copiar macro do Roll20">R20</button>`;
async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
}
function fecharMenuMacro() { document.querySelector('.menu-macro')?.remove(); }
document.addEventListener('click', async (e) => {
  const op = e.target.closest('.menu-macro [data-i]');
  if (op) { const m = op.parentElement._macros[+op.dataset.i]; fecharMenuMacro(); await copiarTexto(m.macro); toast('Macro copiada: ' + esc(m.rotulo) + '. Cole no chat do Roll20.'); return; }
  const b = e.target.closest('[data-macro]');
  if (!b) { fecharMenuMacro(); return; }
  e.stopPropagation(); fecharMenuMacro();
  try {
    const id = b.dataset.macro, cat = id.replace(/\d+$/, '');
    const r = await api(`/api/comp/macro?cat=${cat}&id=${encodeURIComponent(id)}&lang=${IDIOMA}`);
    if (r.macros.length > 1) {
      const menu = document.createElement('div'); menu.className = 'menu-macro'; menu._macros = r.macros;
      menu.innerHTML = r.macros.map((m, i) => `<button type="button" data-i="${i}">${esc(m.rotulo)}</button>`).join('');
      const rc = b.getBoundingClientRect();
      menu.style.top = (rc.bottom + window.scrollY + 4) + 'px'; menu.style.left = Math.max(8, Math.min(rc.left + window.scrollX, window.innerWidth - 260)) + 'px';
      document.body.appendChild(menu);
      return;
    }
    await copiarTexto(r.macros[0].macro);
    b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 1500);
    toast(r.avisos?.length ? 'Macro do Roll20 copiada. Confira: ' + esc(r.avisos[0]) : 'Macro do Roll20 copiada. Cole no chat ou numa macro do Roll20.');
  } catch (err) { toast(esc(err.message)); }
}, true);

let leitorAtual = null;

// ============================================================ acerto e dano por poder
// Os números vêm de /api/poder-stats (poder-stats.mjs), a mesma função para o Builder (detalhe do poder) e a Sheet (cartão
// do grimório). Aqui só há formatação.
const ROT_STATS = { 'half your level': 'metade do seu nível', 'proficiency bonus': 'bônus de proficiência', 'enhancement bonus': 'bônus de aprimoramento', 'feat bonus': 'bônus de talento', 'power bonus': 'bônus do poder', bonus: 'bônus' };
const ATR_STATS = { Strength: 'Força', Constitution: 'Constituição', Dexterity: 'Destreza', Intelligence: 'Inteligência', Wisdom: 'Sabedoria', Charisma: 'Carisma' };
const DEF_STATS = { AC: 'CA', Fortitude: 'Fortitude', Reflex: 'Reflexos', Will: 'Vontade' };
const ESTADO_STATS = { prone: 'derrubado', bloodied: 'sangrando', dazed: 'pasmo', stunned: 'atordoado', slowed: 'lento', immobilized: 'imobilizado', restrained: 'contido' };
async function statsDosPoderes(ids) {
  if (!P || P.tipo === 'criatura' || !ids.length) return {};
  try { return (await api('/api/poder-stats', { method: 'POST', body: { ficha: { ...P, retrato: null, notas: [], historico: [] }, ids } })).stats; } catch { return {}; }
}
function rotuloStat(l) {
  const pt = IDIOMA === 'pt';
  const m = /^(\w+) modifier$/.exec(l.label);
  const nome = m ? (pt ? 'modificador de ' + (ATR_STATS[m[1]] || m[1]) : l.label) : (pt ? ROT_STATS[l.label] || l.label : l.label);
  const fonte = /^Talento: /.test(l.source) ? ' - ' + l.source.slice(9) : '';
  return sinal(l.value) + ' ' + nome + fonte;
}
function condicaoStat(c) {
  if (IDIOMA !== 'pt') return c.condition;
  if (c.conditionPt) return c.conditionPt.replace(/\?$/, '').toLowerCase();
  return c.condition.replace(/against an? (\w+) target/, (x, e) => 'contra um alvo ' + (ESTADO_STATS[e] || e));
}
// um efeito condicional: valor ou dado, ataque ou dano, a condição e a fonte (pergunta Sim/Não no Roll20, crítico ou só informativo)
function textoCondicional(c) {
  const pt = IDIOMA === 'pt';
  const valor = c.dice || (c.value != null ? sinal(c.value) : '');
  if (!valor && c.note) return c.note + ' - ' + c.source + (pt ? ' (não calculado).' : ' (not calculated).'); // valor que depende de outra coisa: só a explicação
  const alvo = c.appliesTo === 'attack' ? (pt ? 'de ataque' : 'to attack rolls') : (pt ? 'de dano' : 'to damage rolls');
  const marca = c.kind === 'critical' ? (pt ? ' (no acerto crítico)' : ' (on a critical hit)') : c.kind === 'info' ? (pt ? ' (não calculado)' : ' (not calculated)') : '';
  const cond = c.kind === 'critical' && !c.critAsk ? '' : (pt ? ' se: ' : ' if: ') + condicaoStat(c);
  return valor + ' ' + alvo + cond + ' - ' + c.source + marca + '.';
}
const defStat = (d) => (IDIOMA === 'pt' ? DEF_STATS[d] || d : d);
// Builder: resumo + detalhe linha a linha, uma seção por arma/implemento
function htmlStatsBuilder(r) {
  if (!r || r.erro) return '';
  const pt = IDIOMA === 'pt';
  if (!r.results.length) return '<div class="stats-poder"><div class="rotulo">' + (pt ? 'Nenhuma arma ou implemento equipado serve a este poder.' : 'No equipped weapon or implement fits this power.') + '</div></div>';
  return r.results.map((x) => {
    const lista = (ls) => ls.map((l) => (l.applied ? '<span>' + esc(rotuloStat(l)) + '.</span>' : '<span class="riscado" title="' + (pt ? 'não acumula com o mesmo tipo' : 'does not stack') + '">' + esc(rotuloStat(l)) + '.</span>')).join(' ');
    return '<div class="stats-poder"><div class="stats-titulo">' + (pt ? 'Seus números com ' : 'Your stats using ') + esc(x.source.name) + '</div>' +
      '<div class="stats-resumo">' + (x.attackTotal != null ? '<b>' + sinal(x.attackTotal) + '</b> ' + (pt ? 'de ataque vs ' : 'attack bonus vs ') + esc(defStat(x.defense)) + '. ' : '') + (x.damageExpression ? '<b>' + esc(x.damageExpression) + '</b> ' + (pt ? 'de dano.' : 'damage.') : '') + '</div>' +
      x.conditionalModifiers.map((c) => '<div class="stats-cond">' + esc(textoCondicional(c)) + '</div>').join('') +
      (x.attackBreakdown ? '<div class="rotulo mt-1">' + (pt ? 'Detalhe do ataque:' : 'Breakdown of your attack bonus:') + '</div><div>' + lista(x.attackBreakdown) + '</div>' : '') +
      (x.damageBreakdown ? '<div class="rotulo mt-1">' + (pt ? 'Detalhe do dano:' : 'Breakdown of your damage:') + '</div><div>' + lista(x.damageBreakdown) + '</div>' : '') + '</div>';
  }).join('');
}
// Sheet: só o resumo, uma linha por arma/implemento
function htmlStatsSheet(r) {
  if (!r || r.erro || !r.results.length) return '';
  const pt = IDIOMA === 'pt';
  const principal = r.results.find((x) => x.attackTotal != null);
  const cond = [...new Map(r.results.flatMap((x) => x.conditionalModifiers).map((c) => [c.source + c.condition + c.appliesTo + (c.dice || c.value), c])).values()];
  return '<div class="stats-sheet">' + (principal ? '<div class="stats-grande">' + (pt ? 'ATAQUE ' : 'ATTACK ') + '<b>' + principal.attackTotal + '</b> vs ' + esc(defStat(principal.defense)) + '</div>' : '') +
    r.results.map((x) => '<div>' + esc(x.source.name) + ': ' + (x.attackTotal != null ? sinal(x.attackTotal) + (pt ? ' ataque' : ' attack') : '') + (x.attackTotal != null && x.damageExpression ? ', ' : '') + (x.damageExpression ? esc(x.damageExpression) + (pt ? ' dano' : ' damage') : '') + '</div>').join('') +
    (cond.length ? '<div class="stats-cond">' + (pt ? 'EFEITOS ADICIONAIS: ' : 'ADDITIONAL EFFECTS: ') + cond.map((c) => esc(textoCondicional(c))).join(' ') + '</div>' : '') + '</div>';
}
async function abrirLeitor(cat, id) {
  leitorAtual = { cat, id };
  const alvo = $('#leitor');
  alvo.innerHTML = '<div class="carregando">Abrindo o tomo…</div>';
  modal('modalLeitor').show();
  try {
    const det = await getDet(cat, id);
    alvo.innerHTML = `<div class="rotulo mb-1">${esc(NOME_CAT[cat] || cat)} · ${esc(det.meta.SourceBook || '')}</div>${htmlCarta(det)}${cat === 'monster' ? `<div class="text-end mt-2"><button class="btn-rpg" id="monstro-criar">🐉 Criar criatura a partir deste monstro</button></div>` : ''}`;
    if (cat === 'monster') $('#monstro-criar').onclick = () => criaturaDeMonstro(id);
    if (cat === 'power' && P && P.tipo !== 'criatura') statsDosPoderes([id]).then((st) => { if (leitorAtual?.id === id && st[id]) alvo.insertAdjacentHTML('beforeend', htmlStatsBuilder(st[id])); });
  } catch (e) { alvo.innerHTML = `<p>${esc(e.message)}</p>`; }
}

// ============================================================ seletor do compêndio
const CLASSES = { lista: null };
async function listaClasses() {
  if (!CLASSES.lista) { try { CLASSES.lista = (await api('/api/comp/buscar?cat=class&limite=300')).itens.map((c) => c.Name); } catch { CLASSES.lista = []; } }
  return CLASSES.lista;
}
let pickerRefresh = null;

// opcoes: { cats, titulo, filtros:{classe,nivelMax,raridade,escudo,baseCat,baseId}, manter, aviso, onPick(meta, cat) }
async function escolher(opcoes) {
  const cats = opcoes.cats;
  let cat = cats[0];
  const f = { q: '', classe: opcoes.filtros?.classe || '', nivelMax: opcoes.filtros?.nivelMax ?? '', tipo: '', ...opcoes.filtros };
  let selecionado = null;
  const multi = !!opcoes.multi;
  const marcados = new Map(); // key "cat:ID" -> {item, cat} — persiste entre buscas, só no modo multi
  $('#pk-titulo').textContent = opcoes.titulo;
  $('#pk-acoes').innerHTML = ''; $('#pk-previa').innerHTML = ''; // limpa resto de uma abertura anterior (senão o botão Carregar fica preso no onPickMulti velho)
  const lista = await listaClasses();

  const montarFiltros = () => {
    const abas = cats.length > 1 ? `<div class="col-12 d-flex gap-1 flex-wrap">${cats.map((c) => `<button class="btn-rpg-mini ${c === cat ? 'fw-bold' : ''}" data-cat="${c}" style="${c === cat ? 'background:var(--ouro2)' : ''}">${NOME_CAT[c]}</button>`).join('')}</div>` : '';
    $('#pk-filtros').innerHTML = abas + `
      ${opcoes.aviso ? `<div class="col-12 rotulo">${opcoes.aviso}</div>` : ''}
      <div class="col-md-4"><input class="form-control" id="pk-q" placeholder="Nome ou texto (inglês ou português)…" value="${esc(f.q)}"></div>
      ${cat === 'power' ? `<div class="col-md-3"><input class="form-control" id="pk-classe" list="pk-classes" placeholder="Classe" value="${esc(f.classe)}"><datalist id="pk-classes">${lista.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="col-md-2"><input class="form-control" id="pk-nv" type="number" min="0" max="30" placeholder="Nível máx." value="${esc(f.nivelMax)}"></div>
      <div class="col-md-3"><select class="form-select" id="pk-tipo"><option value="">Qualquer tipo</option><option value="at-will">Sem limite</option><option value="enc">Encontro</option><option value="daily">Diário</option><option value="utility">Utilitário</option></select></div>`
      : (opcoes.filtros?.nivelMax !== undefined ? `<div class="col-md-3"><input class="form-control" id="pk-nv" type="number" min="0" max="35" placeholder="Nível máx." value="${esc(f.nivelMax)}"></div>` : '')}`;
    $('#pk-q').oninput = (e) => { f.q = e.target.value; buscar(); };
    if ($('#pk-classe')) { $('#pk-classe').oninput = (e) => { f.classe = e.target.value; buscar(); }; $('#pk-tipo').value = f.tipo; $('#pk-tipo').onchange = (e) => { f.tipo = e.target.value; buscar(); }; }
    if ($('#pk-nv')) $('#pk-nv').oninput = (e) => { f.nivelMax = e.target.value; buscar(); };
    $$('#pk-filtros [data-cat]').forEach((b) => b.onclick = () => { cat = b.dataset.cat; selecionado = null; montarFiltros(); buscar(); mostrarPrevia(); });
  };
  let t;
  const buscar = () => { clearTimeout(t); t = setTimeout(rodar, 220); };
  const rodar = async () => {
    const qs = new URLSearchParams({ cat, limite: 120 });
    for (const k of ['q', 'classe', 'nivelMax', 'tipo', 'raridade', 'escudo', 'baseCat', 'baseId']) if (f[k] !== undefined && f[k] !== '') qs.set(k, f[k]);
    try {
      const r = await api('/api/comp/buscar?' + qs);
      const cols = r.colunas.filter((c) => !['ID', 'Name'].includes(c)).slice(0, 5);
      $('#pk-lista').innerHTML = `<table class="res-tab"><thead><tr>${multi ? '<th></th>' : ''}<th>Nome</th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.itens.map((i) =>
        `<tr data-id="${esc(i.ID)}" class="${multi && marcados.has(cat + ':' + i.ID) ? 'sel' : ''}">${multi ? `<td><input type="checkbox" class="form-check-input" ${marcados.has(cat + ':' + i.ID) ? 'checked' : ''}></td>` : ''}<td><b>${esc(i.Name)}</b>${i.NomePT ? `<br><span class="pt-nome">${esc(i.NomePT)}</span>` : ''}${i._no_texto ? ' <span class="tag">no texto</span>' : ''}</td>${cols.map((c) => `<td>${esc(i[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      $('#pk-rodape').textContent = r.total > r.itens.length ? `Mostrando ${r.itens.length} de ${r.total}. Refine a busca.` : `${r.total} resultado(s).`;
      $$('#pk-lista tbody tr').forEach((tr) => tr.onclick = () => {
        const item = r.itens.find((x) => x.ID === tr.dataset.id);
        selecionado = item;
        if (multi) {
          const k = cat + ':' + item.ID;
          if (marcados.has(k)) marcados.delete(k); else marcados.set(k, { item, cat });
          tr.classList.toggle('sel', marcados.has(k));
          $('input[type=checkbox]', tr).checked = marcados.has(k);
          atualizarBarraMulti();
        } else { $$('#pk-lista tr.sel').forEach((x) => x.classList.remove('sel')); tr.classList.add('sel'); }
        mostrarPrevia();
      });
    } catch (e) { $('#pk-lista').innerHTML = `<p>${esc(e.message)}</p>`; }
  };
  const atualizarBarraMulti = () => {
    if (!multi) return;
    $('#pk-rodape-multi').textContent = marcados.size ? `${marcados.size} selecionado(s).` : 'Marque quantos quiser, pesquisando à vontade.';
    $('#pk-ok-multi').disabled = !marcados.size;
    $('#pk-ok-multi').textContent = `✅ Carregar ${marcados.size} selecionado(s)`;
  };
  const montarBarraMulti = () => {
    $('#pk-acoes').innerHTML = `<div class="d-flex justify-content-between align-items-center gap-2 flex-wrap"><span class="rotulo" id="pk-rodape-multi"></span><button class="btn-rpg" id="pk-ok-multi" disabled>✅ Carregar 0 selecionado(s)</button></div>`;
    $('#pk-ok-multi').onclick = () => { opcoes.onPickMulti([...marcados.values()]); modal('modalPicker').hide(); };
    atualizarBarraMulti();
  };
  const mostrarPrevia = async () => {
    if (multi) { if (!$('#pk-ok-multi')) montarBarraMulti(); if (!selecionado) { $('#pk-previa').innerHTML = '<p class="text-muted">Clique numa linha para marcar (e ver o texto).</p>'; return; } }
    else if (!selecionado) { $('#pk-previa').innerHTML = '<p class="text-muted">Escolha uma linha para ver o texto completo.</p>'; $('#pk-acoes').innerHTML = ''; return; }
    const sel = selecionado;
    $('#pk-previa').innerHTML = '<div class="carregando">…</div>';
    try {
      const det = await getDet(cat, sel.ID);
      if (sel !== selecionado) return;
      $('#pk-previa').innerHTML = htmlCarta(det);
      if (!multi) { $('#pk-acoes').innerHTML = `<button class="btn-rpg" id="pk-ok">${opcoes.manter ? '＋ Adicionar' : 'Escolher'}</button>`;
        $('#pk-ok').onclick = () => { opcoes.onPick(sel, cat); if (!opcoes.manter) modal('modalPicker').hide(); }; }
    } catch (e) { $('#pk-previa').innerHTML = `<p>${esc(e.message)}</p>`; }
  };
  pickerRefresh = mostrarPrevia;
  montarFiltros(); mostrarPrevia(); rodar();
  modal('modalPicker').show();
  setTimeout(() => $('#pk-q')?.focus(), 400);
}

// ============================================================ tela inicial
async function irParaHome() {
  if (P) { await salvarAgora(); P = null; CALC = null; }
  $('#janelas').innerHTML = '';
  desenharHome();
}
async function desenharHome() {
  const el = $('#principal');
  el.innerHTML = '<div class="carregando">Abrindo o grimório…</div>';
  let lista = [], comp = null;
  try { [lista, comp] = await Promise.all([api('/api/personagens'), api('/api/comp/status')]); } catch (e) { el.innerHTML = `<div class="folha">${esc(e.message)}</div>`; return; }
  const vazio = Object.values(comp.categorias).every((c) => !c.itens);
  el.innerHTML = `
    ${vazio ? `<div class="folha mb-3"><h3>📜 Compêndio ainda não baixado</h3><p>Preciso copiar o compêndio do <b>iws.mx</b> uma vez (cerca de 25 MB, alguns minutos). Depois tudo funciona sem internet.</p><button class="btn-rpg" id="baixar-comp">Baixar compêndio agora</button> <span id="baixar-info"></span></div>` : ''}
    <div class="d-flex align-items-center mb-3 gap-2 flex-wrap"><h2 class="titulo m-0 flex-grow-1" style="color:var(--ouro2)">Seus aventureiros</h2>
      <label class="btn-rpg-sec m-0" title="Aceita .dnd4e (Character Builder), .json (ficha exportada daqui) e PDF">📥 Importar ficha<input type="file" id="arq-imp" accept=".pdf,.dnd4e,.xml,.json" hidden></label>
      <button class="btn-rpg" id="novo-pers">＋ Novo personagem</button>
      <button class="btn-rpg" id="nova-criatura" style="background:linear-gradient(#8e1b1b,#5a1111)" title="Monstros, chefes e NPCs para o mestre">🐉 Nova criatura</button></div>
    <div class="row g-3">${lista.filter((p) => p.tipo !== 'criatura').map(cartaoHome).join('')}
      ${lista.some((p) => p.tipo !== 'criatura') ? '' : '<div class="col-12"><div class="folha cartao-novo">Nenhum personagem ainda. Crie um novo ou importe uma ficha.</div></div>'}</div>
    ${lista.some((p) => p.tipo === 'criatura') ? `<h2 class="titulo mt-4 mb-3" style="color:var(--ouro2)">Criaturas do mestre</h2><div class="row g-3">${lista.filter((p) => p.tipo === 'criatura').map(cartaoHome).join('')}</div>` : ''}`;
  rodapeDados(el);
  $('#novo-pers').onclick = async () => { const p = await api('/api/personagens', { method: 'POST', body: {} }); abrirPersonagem(p.id); };
  $('#nova-criatura').onclick = novaCriaturaUI;
  $('#arq-imp').onchange = (e) => importar(e.target.files[0]);
  $$('.cartao-pers').forEach((c) => c.onclick = (e) => { if (!e.target.closest('[data-del]')) abrirPersonagem(c.dataset.id); });
  $$('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Mover este personagem para a lixeira (pasta dados\\lixeira)?')) return;
    await api('/api/personagens/' + b.dataset.del, { method: 'DELETE' }); desenharHome();
  });
  $$('[data-ret]').forEach(async (img) => { try { const p = await api('/api/personagens/' + img.dataset.ret); img.src = p.retrato; } catch { /* sem retrato */ } });
  if ($('#baixar-comp')) $('#baixar-comp').onclick = baixarCompendio;
}
function cartaoHome(p) {
  const cr = p.tipo === 'criatura';
  return `<div class="col-md-6 col-lg-4"><div class="folha cartao-pers" data-id="${p.id}"><div class="d-flex gap-3 align-items-center">
        <div class="ret">${p.retrato ? `<img src="" data-ret="${p.id}" style="width:100%;height:100%;object-fit:cover">` : (cr ? '🐉' : '🛡️')}</div>
        <div class="flex-grow-1"><div class="nome">${esc(p.nome)}</div><div>${esc([p.raca, p.classe].filter(Boolean).join(' · ') || (cr ? 'Criatura' : 'Sem raça/classe ainda'))}</div>
        <div class="rotulo">Nível ${p.nivel} · ${p.notas} anotações</div><div class="rotulo">${dataBR(p.atualizado)}</div></div>
        <button class="btn-rpg-mini" data-del="${p.id}" title="Mover para a lixeira">🗑</button></div></div></div>`;
}
async function baixarCompendio() {
  await api('/api/comp/atualizar', { method: 'POST' });
  const info = $('#baixar-info') || document.createElement('span');
  const t = setInterval(async () => {
    const s = await api('/api/comp/status').catch(() => null);
    if (!s) return;
    const n = Object.values(s.categorias).reduce((a, c) => a + c.itens, 0);
    info.textContent = ` baixando… ${n} entradas`;
    if (!s.atualizando) { clearInterval(t); toast('Compêndio atualizado!'); if (!P) desenharHome(); }
  }, 3000);
}

async function importar(arq) {
  if (!arq) return;
  const el = $('#principal');
  const pdf = /\.pdf$/i.test(arq.name);
  el.innerHTML = `<div class="folha carregando" style="color:var(--tinta)"><span class="spin"></span> Lendo <b>${esc(arq.name)}</b>…</div>`;
  try {
    const base64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = no; r.readAsDataURL(arq); });
    let r = await api('/api/importar', { method: 'POST', body: { nome: arq.name, base64 } });
    if (r.conflito) {
      const acao = confirm(`Já existe "${r.conflito.nome}" (${r.conflito.notas} anotações).

OK = ATUALIZAR a ficha existente (as anotações são mantidas)
Cancelar = criar uma ficha NOVA separada`) ? 'atualizar' : 'nova';
      r = await api('/api/importar', { method: 'POST', body: { nome: arq.name, base64, acao } });
    }
    const f = r.ficha;
    const sem = [...f.poderes, ...f.talentos].filter((x) => !x.id).map((x) => x.nome);
    toast(`<b>${esc(f.nome)}</b> importado: ${f.poderes.length} poderes, ${f.talentos.length} talentos, ${f.itens.length} itens.${sem.length ? `<br>Sem correspondência no compêndio (ficam como texto): ${esc(sem.slice(0, 8).join(', '))}${sem.length > 8 ? '…' : ''}` : ''}`, false, 12000);
    abrirPersonagem(f.id);
  } catch (e) {
    await desenharHome();
    $('#principal').insertAdjacentHTML('afterbegin', `<div class="folha mb-3" style="border-color:var(--sangue)"><h3>Não consegui importar ${esc(arq.name)}</h3><p class="mb-1">${esc(e.message)}</p>${pdf ? '<p class="mb-0 rotulo">Dica: abra a ficha no app e use ⬇ PDF editável; esse PDF você preenche no leitor de PDF e importa de volta.</p>' : ''}<button class="btn-rpg-mini mt-2" onclick="this.closest('.folha').remove()">Fechar</button></div>`);
  }
}

// ============================================================ ficha
async function abrirPersonagem(id) {
  $('#principal').innerHTML = '<div class="carregando">Desenrolando o pergaminho…</div>';
  try { P = await api('/api/personagens/' + id); } catch (e) { toast(esc(e.message), true); return desenharHome(); }
  if (P.tipo === 'criatura') return abrirCriatura();
  P.notas = P.notas || []; P.historico = P.historico || []; P.itens = P.itens || []; P.ajustes = P.ajustes || {}; P.poderOverrides = P.poderOverrides || {};
  if (!P.atr) { // fichas antigas guardavam o valor final: tira os +1 automáticos dos níveis 11 e 21
    const tier = (P.nivel >= 11 ? 1 : 0) + (P.nivel >= 21 ? 1 : 0);
    P.atr = { base: Object.fromEntries(Object.entries(P.atributos || {}).map(([k, v]) => [k, v - tier])), racial: {}, aumentos: {} };
  }
  P.ouro = P.ouro ?? 0;
  P.itens.forEach((i) => { if (!i.id) i.id = uid(); });
  desenharFicha();
  P.notas.filter((n) => n.janela?.aberta).forEach((n) => abrirJanelaNota(n.id));
}

function desenharFicha() {
  const el = $('#principal');
  const abas = [['ficha', '📜 Ficha'], ['poderes', '✨ Poderes'], ['inventario', '🎒 Inventário'], ['notas', '🗒️ Anotações'], ['historico', '🕰️ Histórico']];
  el.innerHTML = `
    <div class="folha mb-2"><div class="faixa-nome">
      <div id="retrato" title="Clique para trocar o retrato" style="${P.retrato ? `background-image:url('${P.retrato}')` : ''}">${P.retrato ? '' : '🛡️'}</div>
      <div class="flex-grow-1" style="min-width:230px"><input class="nome-grande" value="${esc(P.nome)}" placeholder="Nome do personagem">
        <div class="rotulo mt-1" id="resumo-linha"></div></div>
      <div class="text-end"><button class="btn-rpg" id="abrir-grimorio">📖 Abrir grimório de poderes</button>
        <div class="mt-2">
          <select class="btn-rpg-mini" id="sel-sistema" title="Sistema de RPG desta ficha" disabled><option value="dnd4e">D&D 4e</option></select>
          <select class="btn-rpg-mini" id="sel-plataforma" title="Onde esta ficha vai ser usada: muda quais botões de exportação aparecem">
            <option value="nenhuma">Exportar para: nenhuma plataforma</option>
            <option value="roll20">Exportar para: Roll20</option>
            <option value="foundry">Exportar para: Foundry VTT</option>
          </select>
        </div>
        <div class="mt-2" id="botoes-plataforma"></div>
        <div class="mt-2"><button class="btn-rpg-sec btn-sm" id="exportar-pdf" title="Ficha em PDF com campos editáveis: preencha no leitor de PDF e importe de volta">⬇ PDF editável</button>
        <button class="btn-rpg-sec btn-sm" id="exportar-cb" title="Arquivo .dnd4e no formato do Character Builder: todo personagem de D&D 4e tem esse botão, para abrir no CB">⬇ .dnd4e (Character Builder)</button>
        <button class="btn-rpg-mini" id="exportar" title="Arquivo .json da ficha (cópia exata, para guardar ou mandar a um amigo)">.json</button></div>
        <div class="mt-2"><button class="btn-rpg-mini" id="salvar-agora" title="Grava a ficha agora (também grava sozinha a cada alteração)">💾 Salvar</button> <span class="rotulo" id="status-salvo">Salvo ✓ ${dataBR(P.atualizado)}</span></div></div>
      <input type="file" id="arq-ret" accept="image/*" hidden></div>
      <div id="painel-avisos" class="mt-2"></div></div>
    <div class="abas">${abas.map(([k, n]) => `<div class="aba ${aba === k ? 'ativa' : ''}" data-aba="${k}">${n}</div>`).join('')}</div>
    <div id="conteudo-aba"></div>`;
  $$('.aba').forEach((a) => a.onclick = () => { aba = a.dataset.aba; sessionStorage.setItem('aba', aba); $$('.aba').forEach((x) => x.classList.toggle('ativa', x === a)); desenharAba(); });
  $('#abrir-grimorio').onclick = abrirGrimorio;
  $('#exportar').onclick = () => { const blob = new Blob([JSON.stringify({ ...P }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (P.nome || 'ficha').replace(/[^\w-]+/g, '_') + '.json'; a.click(); };
  // Ficha para o Roll20: valores já calculados nos campos da ficha "D&D 4E" + macros. O script grimorio-importador.js lê isto.
  async function fichaRoll20() {
    await salvarAgora();
    const r = await fetch(`/api/exportar-roll20?lang=${IDIOMA}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Falha ao gerar a ficha do Roll20.');
    return r.json();
  }
  async function fichaFoundry() {
    await salvarAgora();
    const r = await fetch(`/api/exportar-foundry?lang=${IDIOMA}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'Falha ao gerar o Foundry .json.');
    return d;
  }
  // Botões de exportação específicos da plataforma escolhida (Roll20/Foundry): só aparecem os desta plataforma,
  // em vez de empilhar todos os "copiar para X" juntos. PDF/.json/.dnd4e ficam sempre visíveis (universais).
  function desenharBotoesPlataforma() {
    const box = $('#botoes-plataforma');
    if (P.plataforma === 'roll20') {
      box.innerHTML = `<button class="btn-rpg-sec btn-sm" id="copiar-r20" title="Copia a ficha pronta para o Roll20 (cole nas notas de um handout e use !grimorio-importar)">📋 Copiar p/ Roll20</button>
        <button class="btn-rpg-mini" id="baixar-r20" title="Baixa o mesmo conteúdo como arquivo .roll20.json">.roll20.json</button>
        <a class="btn-rpg-mini" href="/api/importador-roll20" title="Script (Roll20 Pro) que lê a ficha dentro do Roll20. Instale uma vez em Configurações do jogo > Mod (API) Scripts">script Roll20</a>`;
      $('#copiar-r20').onclick = async (e) => {
        e.target.disabled = true;
        try {
          const f = await fichaRoll20();
          await copiarTexto(JSON.stringify(f));
          toast('Ficha copiada. No Roll20: clique no botão "Grimório" (extensão), cole e importe. Com o plano Pro: cole nas notas de um handout chamado "' + esc(P.nome) + '" e digite !grimorio-importar ' + esc(P.nome) + (f.avisos?.length ? '. Atenção: ' + esc(f.avisos[0]) : ''), false, 14000);
        } catch (err) { toast('Roll20: ' + esc(err.message), true, 8000); }
        e.target.disabled = false;
      };
      $('#baixar-r20').onclick = async (e) => {
        e.target.disabled = true;
        try {
          const f = await fichaRoll20();
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(f)], { type: 'application/json' })); a.download = (P.nome || 'ficha').replace(/[^\w-]+/g, '_') + '.roll20.json'; a.click();
          toast('Arquivo salvo. Abra no Bloco de Notas, copie tudo e cole nas notas de um handout do Roll20.', false, 9000);
        } catch (err) { toast('Roll20: ' + esc(err.message), true, 8000); }
        e.target.disabled = false;
      };
    } else if (P.plataforma === 'foundry') {
      box.innerHTML = `<button class="btn-rpg-sec btn-sm" id="baixar-foundry" title="Arquivo .json de Actor para importar direto no Foundry (Import Data, na ficha do personagem)">⬇ Foundry .json</button>`;
      $('#baixar-foundry').onclick = async (e) => {
        e.target.disabled = true;
        try {
          const d = await fichaFoundry();
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d.json, null, 1)], { type: 'application/json' })); a.download = (P.nome || 'ficha').replace(/[^\w-]+/g, '_') + '.foundry.json'; a.click();
          toast(d.avisos?.length ? `Arquivo gerado. ${d.avisos.length} item(ns) sem correspondência no compêndio ficaram de fora: ${d.avisos.slice(0, 3).join(' · ')}` : 'Arquivo gerado. No Foundry: abra o personagem e use Import Data (ícone de importar, no topo da ficha).', false, 10000);
        } catch (err) { toast('Foundry: ' + esc(err.message), true, 8000); }
        e.target.disabled = false;
      };
    } else {
      box.innerHTML = '';
    }
  }
  P.plataforma = P.plataforma || 'nenhuma';
  $('#sel-plataforma').value = P.plataforma;
  $('#sel-plataforma').onchange = (e) => { P.plataforma = e.target.value; agendarSalvar(); desenharBotoesPlataforma(); };
  desenharBotoesPlataforma();
  $('#salvar-agora').onclick = salvarAgora;
  $('#exportar-cb').onclick = async (e) => {
    e.target.disabled = true;
    try {
      await salvarAgora();
      const r = await fetch('/api/exportar-dnd4e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao gerar o .dnd4e.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([d.xml], { type: 'application/xml' })); a.download = (P.nome || 'ficha').replace(/[^\w-]+/g, '_') + '.dnd4e'; a.click();
      toast(d.avisos.length ? `.dnd4e gerado. ${d.avisos.length} item(ns) sem equivalente no Character Builder ficaram de fora ou nas notas: ${d.avisos.slice(0, 3).join(' · ')}` : '.dnd4e gerado no formato do Character Builder.', false, 9000);
    } catch (err) { toast(err.message, true); }
    e.target.disabled = false;
  };
  $('#exportar-pdf').onclick = async (e) => {
    e.target.disabled = true;
    try {
      await salvarAgora();
      const r = await fetch('/api/exportar-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Falha ao gerar o PDF.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = (P.nome || 'ficha').replace(/[^\w-]+/g, '_') + '.pdf'; a.click();
      toast('PDF gerado. Abra em qualquer leitor de PDF, preencha os campos e importe de volta quando quiser.', false, 7000);
    } catch (err) { toast('PDF: ' + esc(err.message), true, 8000); }
    e.target.disabled = false;
  };
  $('#retrato').onclick = () => $('#arq-ret').click();
  $('#arq-ret').onchange = (e) => trocarRetrato(e.target.files[0]);
  $('.nome-grande').oninput = (e) => { P.nome = e.target.value; agendarSalvar(); };
  desenharAba();
  resumoLinha();
  recalcular(true);
}
function resumoLinha() {
  const e = $('#resumo-linha');
  if (e) e.textContent = ['Nível ' + P.nivel, P.raca?.nome, nomeClasse(P), P.paragon?.nome, P.destino?.nome].filter(Boolean).join(' · ');
}
function trocarRetrato(arq) {
  if (!arq) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'), s = 320;
    c.width = c.height = s;
    const m = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
    P.retrato = c.toDataURL('image/jpeg', 0.85);
    $('#retrato').style.backgroundImage = `url('${P.retrato}')`; $('#retrato').textContent = '';
    agendarSalvar();
  };
  img.src = URL.createObjectURL(arq);
}
function desenharAba() {
  ({ ficha: abaFicha, poderes: abaPoderes, inventario: abaInventario, notas: abaNotas, historico: abaHistorico })[aba]();
  aplicarCalculo();
}

// ligação genérica de campos [data-bind]
function ligarCampos(raiz) {
  $$('[data-bind]', raiz).forEach((i) => {
    const caminho = i.dataset.bind;
    if (i.type === 'checkbox') { i.checked = !!ler(caminho); i.onchange = () => { definir(P, caminho, i.checked); recalcular(); agendarSalvar(); }; return; }
    if (i !== document.activeElement) i.value = ler(caminho) ?? '';
    i.oninput = () => {
      let v = i.value;
      if (i.type === 'number') v = v === '' ? 0 : +v;
      definir(P, caminho, v);
      if (caminho === 'nivel') resumoLinha();
      recalcular(); agendarSalvar();
    };
  });
}

// classe híbrida: o CB guarda só "Hybrid" e as duas classes ficam nos elementos Hybrid Class
function nomeClasse(Q) {
  const n = Q.classe?.nome || '';
  if (!/^hybrid/i.test(n)) return n;
  const h = (Q.extras || []).filter((e) => /^ID_FMP_HYBRID_CLASS_/.test(e.id)).map((e) => e.nome.replace(/^Hybrid\s+/i, ''));
  return h.length ? 'Híbrido: ' + h.join(' + ') : n;
}
function campoEscolha([chave, cat, rotulo]) {
  const v = P[chave];
  return `<div class="col-sm-6 col-lg-4"><div class="rotulo">${rotulo}</div><div class="escolha">
    <span class="valor ${v ? '' : 'vazio'}" data-ver="${chave}">${esc((chave === 'classe' ? nomeClasse(P) : v?.nome) || 'escolher…')}</span>
    <button class="btn-rpg-mini" data-esc="${chave}">${v ? 'Trocar' : 'Escolher'}</button>${v ? `<button class="btn-rpg-mini" data-limpar="${chave}">✕</button>` : ''}</div></div>`;
}
function ligarEscolhas() {
  $$('[data-esc]').forEach((b) => b.onclick = () => {
    const [chave, cat, rotulo] = ESCOLHAS.find((x) => x[0] === b.dataset.esc);
    escolher({ cats: [cat], titulo: 'Escolher: ' + rotulo, onPick: async (m) => {
      P[chave] = { cat, id: m.ID, nome: m.Name }; log('mudanca', `${rotulo}: ${m.Name}`);
      if (chave === 'raca') await sugerirBonusRaca(m.ID);
      agendarSalvar(); desenharFicha();
    } });
  });
  $$('[data-limpar]').forEach((b) => b.onclick = () => { P[b.dataset.limpar] = null; agendarSalvar(); desenharFicha(); });
  $$('[data-ver]').forEach((b) => b.onclick = () => { const v = P[b.dataset.ver]; if (v?.id) abrirLeitor(v.cat, v.id); });
}
// ao escolher a raça, preenche os bônus de atributo fixos (os "+2 em um ou outro" ficam para você escolher)
async function sugerirBonusRaca(id) {
  try {
    const r = await api('/api/raca-info?id=' + encodeURIComponent(id));
    P.atr.racial = {};
    for (const [k, v] of Object.entries(r.fixos || {})) P.atr.racial[k] = v;
    P.racaOpcoes = r.opcoes || [];
    if (r.opcoes?.length) toast('Esta raça deixa você escolher parte dos bônus de atributo: ' + r.opcoes.map((o) => `+${o.valor} em ${o.entre.join(' ou ').toUpperCase()}`).join('; ') + '. Digite na coluna "Raça".', false, 9000);
  } catch { /* sem sugestão */ }
}

function abaFicha() {
  const c = $('#conteudo-aba');
  const niveis = NIVEIS_AUMENTO.filter((n) => n <= P.nivel);
  c.innerHTML = `
  <div class="row g-3">
    <div class="col-12"><div class="folha"><h2>Quem é</h2><div class="row g-2">
      ${ESCOLHAS.map(campoEscolha).join('')}
      <div class="col-6 col-md-2"><div class="rotulo">Nível</div><input class="form-control" type="number" min="1" max="30" data-bind="nivel"></div>
      <div class="col-6 col-md-2"><div class="rotulo">XP</div><input class="form-control" type="number" data-bind="xp"></div>
      <div class="col-6 col-md-3"><div class="rotulo">Jogador</div><input class="form-control" data-bind="jogador"></div>
      <div class="col-6 col-md-3"><div class="rotulo">Tendência</div><input class="form-control" data-bind="tendencia"></div>
      <div class="col-4 col-md-2"><div class="rotulo">Tamanho</div><input class="form-control" data-bind="tamanho"></div>
      <div class="col-4 col-md-2"><div class="rotulo">Gênero</div><input class="form-control" data-bind="genero"></div>
      <div class="col-4 col-md-2"><div class="rotulo">Idade</div><input class="form-control" data-bind="idade"></div>
      <div class="col-6 col-md-2"><div class="rotulo">Altura</div><input class="form-control" data-bind="altura"></div>
      <div class="col-6 col-md-2"><div class="rotulo">Peso</div><input class="form-control" data-bind="peso"></div>
      <div class="col-12 col-md-6"><div class="rotulo">Idiomas</div><input class="form-control" data-bind="idiomas"></div>
    </div></div></div>

    <div class="col-lg-5"><div class="folha h-100"><h2>Atributos</h2>
      <table class="tabela-per tabela-atr"><thead><tr><th></th><th>Base</th><th>Raça</th><th>Níveis</th><th>Final</th><th>Mod.</th></tr></thead><tbody>
      ${ATRS.map(([k, n, s]) => `<tr><td class="nome-per" title="${n}"><b>${s}</b></td>
        <td><input class="form-control" type="number" data-bind="atr.base.${k}"></td>
        <td><input class="form-control" type="number" data-bind="atr.racial.${k}"></td>
        <td class="text-center" data-calc="niv:${k}"></td>
        <td class="total" data-calc="atr:${k}"></td><td class="total mod" data-calc="mod:${k}"></td></tr>`).join('')}</tbody></table>
      <div class="d-flex gap-2 mt-2 flex-wrap"><button class="btn-rpg-mini" id="aumentos" ${niveis.length ? '' : 'disabled'}>Aumentos por nível (${niveis.length ? niveis.join(', ') : 'a partir do 4'})</button>
        <small class="text-muted align-self-center">Os +1 dos níveis 11 e 21 entram sozinhos.</small></div>
      <div class="rotulo mt-2">Metade do nível: <b data-calc="meio"></b></div></div></div>

    <div class="col-lg-7"><div class="folha h-100"><h2>Defesas e vida <small class="text-muted" style="font-size:.7rem">calculadas — passe o mouse para ver de onde vem cada bônus</small></h2>
      <div class="row g-1 text-center mb-2">${[['ac', 'CA'], ['fort', 'FORT'], ['ref', 'REF'], ['vont', 'VONT']].map(([k, n]) => `<div class="col-3 def"><div class="escudo"><div class="rotulo">${n}</div><div class="num-escudo" data-calc="${k}"></div></div></div>`).join('')}</div>
      <div class="row g-2">
        <div class="col-3"><div class="rotulo">PV máx.</div><div class="num-calc" data-calc="pv"></div></div>
        <div class="col-3"><div class="rotulo">PV atuais</div><input class="form-control" type="number" data-bind="pvAtual"></div>
        <div class="col-3"><div class="rotulo">Pulsos/dia</div><div class="num-calc" data-calc="surtos"></div></div>
        <div class="col-3"><div class="rotulo">Pulsos atuais</div><input class="form-control" type="number" data-bind="surtosAtuais"></div>
        <div class="col-3"><div class="rotulo">Velocidade</div><div class="num-calc" data-calc="vel"></div></div>
        <div class="col-3"><div class="rotulo">Iniciativa</div><div class="num-calc" data-calc="ini"></div></div>
        <div class="col-3"><div class="rotulo">Valor do pulso</div><div class="num-calc" data-calc="valorsurto"></div></div>
        <div class="col-3"><div class="rotulo">Sangrando em</div><div class="num-calc" data-calc="sangrando"></div></div>
        <div class="col-3"><div class="rotulo">Percepção passiva</div><div class="num-calc" data-calc="passiva:Perception"></div></div>
        <div class="col-3"><div class="rotulo">Intuição passiva</div><div class="num-calc" data-calc="passiva:Insight"></div></div>
        <div class="col-12"><div class="barra-vida"><i id="barra-pv"></i></div></div>
        <div class="col-12 d-flex gap-2 flex-wrap"><button class="btn-rpg-mini" id="usar-surto">Usar pulso de cura</button><button class="btn-rpg-mini" id="desc-longo">Descanso longo</button>
          <button class="btn-rpg-mini" id="ajustes-btn">Ajustes manuais ${Object.keys(P.ajustes).length ? '(' + Object.keys(P.ajustes).length + ')' : ''}</button></div>
        <div class="col-12 invisivel" id="ajustes-box"><div class="rotulo">Some ou tire pontos do cálculo (escolhas especiais que o app não lê; fichas importadas guardam aqui a diferença para bater com o original)</div>
          <div class="row g-1">${[['ca', 'CA'], ['fort', 'Fort'], ['ref', 'Ref'], ['vont', 'Vont'], ['pv', 'PV'], ['surtos', 'Pulsos'], ['ini', 'Inic.'], ['vel', 'Vel.']].map(([k, n]) => `<div class="col-3"><div class="rotulo">${n}</div><input class="form-control" type="number" data-bind="ajustes.${k}"></div>`).join('')}</div></div>
      </div>
      <h3 class="mt-3">Ataques das armas equipadas</h3><div id="painel-ataques"></div></div></div>

    <div class="col-lg-6"><div class="folha h-100"><h2>Perícias <small class="text-muted" style="font-size:.7rem">penalidade de armadura: <span data-calc="penal"></span></small></h2><table class="tabela-per">${PERICIAS.map(([n, pt, a]) => { const pe = P.pericias[n] || (P.pericias[n] = { treinada: false, extra: 0 }); return `<tr class="${pe.treinada ? 'trein' : ''}">
      <td class="total" data-calc="per:${n}"></td><td class="nome-per">${pt} <small>(${a.toUpperCase()})</small></td>
      <td><input class="form-check-input" type="checkbox" data-bind="pericias.${n}.treinada" title="Treinada (+5)"></td>
      <td><input class="form-control" type="number" data-bind="pericias.${n}.extra" title="Bônus extra manual"></td></tr>`; }).join('')}</table>
      <div class="rotulo mt-1">☑ treinada (+5) · último campo = bônus extra manual (itens, raça e armadura já entram sozinhos)</div></div></div>

    <div class="col-lg-6"><div class="folha mb-3"><h2>Talentos</h2><div id="lista-talentos"></div>
      <button class="btn-rpg-sec btn-sm mt-2" id="add-talento">＋ Adicionar talento</button></div>
      <div class="folha"><h2>Personalidade</h2>
      <div class="rotulo">Traços</div><textarea class="form-control mb-2" rows="3" data-bind="tracos"></textarea>
      <div class="rotulo">Aparência</div><textarea class="form-control mb-2" rows="2" data-bind="aparencia"></textarea>
      <div class="rotulo">Companheiros</div><textarea class="form-control" rows="2" data-bind="companheiros"></textarea></div></div>
  </div>`;
  ligarCampos(c); ligarEscolhas(); listaTalentos();
  $('#ajustes-btn').onclick = () => $('#ajustes-box').classList.toggle('invisivel');
  $('#aumentos').onclick = abrirAumentos;
  $('#usar-surto').onclick = () => {
    if ((+P.surtosAtuais || 0) <= 0) return toast('Sem pulsos de cura restantes.', true);
    P.surtosAtuais--; P.pvAtual = Math.min(+CALC.pv, (+P.pvAtual || 0) + CALC.valorSurto);
    $('[data-bind=surtosAtuais]').value = P.surtosAtuais; $('[data-bind=pvAtual]').value = P.pvAtual; aplicarCalculo(); agendarSalvar();
  };
  $('#desc-longo').onclick = () => { P.pvAtual = CALC.pv; P.surtosAtuais = CALC.surtos; log('descanso', 'Descanso longo.'); desenharAba(); agendarSalvar(); };
  $('#add-talento').onclick = () => escolher({ cats: ['feat'], titulo: 'Adicionar talentos', multi: true, onPickMulti: (sel) => {
    let n = 0;
    for (const { item: m } of sel) { if (P.talentos.some((t) => t.id === m.ID)) continue; P.talentos.push({ cat: 'feat', id: m.ID, nome: m.Name }); log('talento', 'Talento: ' + m.Name); n++; }
    if (n) { agendarSalvar(); listaTalentos(); recalcular(); toast(`${n} talento(s) adicionado(s).`); } else toast('Nada novo (já estavam na ficha).');
  } });
}
const nomeExibido = (cat, id, base) => P?.poderOverrides?.[cat + ':' + id]?.nome || base;
function listaTalentos() {
  const e = $('#lista-talentos'); if (!e) return;
  e.innerHTML = P.talentos.length ? P.talentos.map((t, i) => `<div class="lista-item"><span class="nm" data-ver="${i}">${esc(nomeExibido('feat', t.id, t.nome))}</span>${t.id ? btnMacro(t.id) : ''}${t.id ? `<button class="btn-rpg-mini" data-ed="${i}" title="Editar (reskin/hotfix, só nesta ficha)">✏</button>` : ''}<button class="btn-rpg-mini" data-rm="${i}">✕</button></div>`).join('') : '<p class="text-muted">Nenhum talento.</p>';
  $$('[data-ver]', e).forEach((b) => b.onclick = () => { const t = P.talentos[+b.dataset.ver]; if (t.id) abrirLeitor('feat', t.id); });
  $$('[data-ed]', e).forEach((b) => b.onclick = () => abrirEditorPoder('feat', P.talentos[+b.dataset.ed].id));
  $$('[data-rm]', e).forEach((b) => b.onclick = () => { P.talentos.splice(+b.dataset.rm, 1); agendarSalvar(); listaTalentos(); recalcular(); });
}
function abrirAumentos() {
  const sel = (lv, i) => `<select class="form-select" data-lv="${lv}" data-i="${i}">${ATRS.map(([k, , s]) => `<option value="${k}" ${(P.atr.aumentos?.[lv] || [])[i] === k ? 'selected' : ''}>${s}</option>`).join('')}<option value="" ${(P.atr.aumentos?.[lv] || [])[i] ? '' : 'selected'}>—</option></select>`;
  $('#leitor').innerHTML = `<h3>Aumentos de atributo por nível</h3><p class="text-muted">Nos níveis 4, 8, 14, 18, 24 e 28 você soma +1 a dois atributos diferentes.</p>
    ${NIVEIS_AUMENTO.filter((n) => n <= P.nivel).map((lv) => `<div class="row g-2 mb-2 align-items-center"><div class="col-3"><b>Nível ${lv}</b></div><div class="col-4">${sel(lv, 0)}</div><div class="col-4">${sel(lv, 1)}</div></div>`).join('')}
    <div class="text-end"><button class="btn-rpg" id="aum-ok">Pronto</button></div>`;
  modal('modalLeitor').show();
  $('#aum-ok').onclick = () => {
    P.atr.aumentos = {};
    for (const lv of NIVEIS_AUMENTO) {
      const v = $$(`#leitor [data-lv="${lv}"]`).map((s) => s.value).filter(Boolean);
      if (v.length) P.atr.aumentos[lv] = v;
    }
    modal('modalLeitor').hide(); agendarSalvar(); recalcular();
  };
}

// ------------------------------------------------------------ poderes
const GRUPOS = [['atwill', 'Sem limite'], ['encounter', 'Encontro'], ['daily', 'Diários'], ['item', 'Itens'], ['outro', 'Outros']];
function grupoDoPoder(w) {
  const t = (w.tipo || w.usoLivre || '').toLowerCase();
  if (/at-?will|à vontade|a vontade/.test(t)) return 'atwill';
  if (/enc/.test(t)) return 'encounter';
  if (/daily|diári|diari/.test(t)) return 'daily';
  return 'outro';
}
const ehUtil = (w) => /utility|utilit/i.test(w.tipo || w.usoLivre || '');

function abaPoderes() {
  const c = $('#conteudo-aba');
  c.innerHTML = `<div class="folha"><div class="d-flex gap-2 flex-wrap align-items-center mb-2"><h2 class="flex-grow-1 mb-0">Poderes</h2>
    <button class="btn-rpg-sec" id="add-poder">＋ Adicionar poder do compêndio</button><button class="btn-rpg" id="abrir-g2">📖 Abrir grimório</button></div>
    ${GRUPOS.filter((g) => g[0] !== 'item').map(([g, nome]) => {
      const ws = P.poderes.map((w, i) => ({ w, i })).filter((x) => grupoDoPoder(x.w) === g).sort((a, b) => (+a.w.nivel || 0) - (+b.w.nivel || 0));
      return ws.length ? `<h4 class="mt-3">${nome}</h4>${ws.map(({ w, i }) => `<div class="lista-item"><span class="tag ${g}">${ehUtil(w) ? 'Utilit.' : 'Ataque'}</span><span class="nm" data-ver="${i}">${esc(nomeExibido('power', w.id, w.nome))}</span>
        <small>${esc([w.classe, w.nivel && 'nív. ' + w.nivel].filter(Boolean).join(' · '))}${w.id ? '' : ' · (sem texto no compêndio)'}</small>${w.id ? btnMacro(w.id) : ''}${w.id ? `<button class="btn-rpg-mini" data-ed="${i}" title="Editar (reskin/hotfix, só nesta ficha)">✏</button>` : ''}<button class="btn-rpg-mini" data-rm="${i}">✕</button></div>`).join('')}` : '';
    }).join('') || '<p class="text-muted">Nenhum poder ainda.</p>'}
    <p class="rotulo mt-3">Poderes de itens aparecem no grimório a partir do inventário (aba Inventário).</p></div>`;
  $$('[data-ed]', c).forEach((b) => b.onclick = () => abrirEditorPoder('power', P.poderes[+b.dataset.ed].id));
  $('#abrir-g2').onclick = abrirGrimorio;
  $('#add-poder').onclick = () => escolher({ cats: ['power'], titulo: 'Adicionar poderes', multi: true, filtros: { classe: P.classe?.nome || '', nivelMax: P.nivel }, onPickMulti: (sel) => {
    let n = 0;
    for (const { item: m } of sel) { if (P.poderes.some((w) => w.id === m.ID)) continue; P.poderes.push({ cat: 'power', id: m.ID, nome: m.Name, tipo: m.Type, nivel: m.Level, classe: m.ClassName }); log('poder', 'Poder: ' + m.Name); n++; }
    if (n) { agendarSalvar(); abaPoderes(); toast(`${n} poder(es) adicionado(s).`); } else toast('Nada novo (já estavam na ficha).');
  } });
  $$('[data-ver]', c).forEach((b) => b.onclick = () => { const w = P.poderes[+b.dataset.ver]; if (w.id) abrirLeitor('power', w.id); });
  $$('[data-rm]', c).forEach((b) => b.onclick = () => { P.poderes.splice(+b.dataset.rm, 1); agendarSalvar(); abaPoderes(); });
}

// ------------------------------------------------------------ inventário (compra, encantamento e equipamento)
const corpoEquip = (it) => it.cat === 'armor' && it.base?.id && it._escudo !== true;
function nomeItem(it) {
  if (it.base && it.ench) return `${it.base.nome} · ${it.ench.nome}${it.ench.mais ? ' +' + it.ench.mais : ''}`;
  if (it.cat === 'item' && it.variante?.mais) return `${it.nome} +${it.variante.mais}`;
  return it.nome;
}
function nivelDoItem(it) { return it.ench?.nivel || it.variante?.nivel || 0; }

// Janela "escolha a versão" (+1, +2…): mostra nível e preço de cada uma e já sugere a que cabe no nível do personagem.
async function escolherVariante(cat, id, nome, extra = {}) {
  const r = await api(`/api/comp/variantes?cat=${cat}&id=${encodeURIComponent(id)}`);
  const vs = r.variantes;
  const cabe = vs.filter((v) => v.nivel <= P.nivel);
  const padrao = cabe.length ? cabe[cabe.length - 1] : vs[0];
  return new Promise((resolve) => {
    $('#leitor').innerHTML = `<h3>${esc(nome)}</h3><p class="text-muted">Seu personagem é nível <b>${P.nivel}</b>. Ouro: <b>${po(P.ouro)} po</b>.</p>
      <div id="vars">${vs.map((v, i) => `<label class="lista-item" style="cursor:pointer"><input type="radio" name="var" value="${i}" ${v === padrao ? 'checked' : ''}>
        <span class="nm">${v.mais ? '+' + v.mais : 'Padrão'} · nível ${v.nivel}</span>${v.nivel > P.nivel ? '<span class="tag" style="background:#f0b4a8">acima do seu nível</span>' : ''}<b>${po(v.custo)} po</b></label>`).join('')}</div>
      <label class="mt-2 d-block"><input type="checkbox" id="var-desc" checked> Descontar do ouro</label>
      <div class="text-end mt-2"><button class="btn-rpg-mini" id="var-cancel">Cancelar</button> <button class="btn-rpg" id="var-ok">${extra.rotuloOk || 'Comprar'}</button></div>`;
    modal('modalLeitor').show();
    $('#var-cancel').onclick = () => { modal('modalLeitor').hide(); resolve(null); };
    $('#var-ok').onclick = () => {
      const v = vs[+($('input[name=var]:checked').value)];
      const desconta = $('#var-desc').checked;
      if (desconta) P.ouro = (+P.ouro || 0) - v.custo;
      modal('modalLeitor').hide(); resolve({ ...v, desconta });
    };
  });
}

async function abaInventario() {
  const c = $('#conteudo-aba');
  c.innerHTML = `<div class="folha"><div class="d-flex gap-2 flex-wrap align-items-center mb-2"><h2 class="flex-grow-1 mb-0">Inventário</h2>
      <div class="d-flex align-items-center gap-1"><span class="rotulo">Ouro (po)</span><input class="form-control" style="width:8rem" type="number" data-bind="ouro"></div></div>
    <p class="text-muted mb-2">Compre pelos botões e marque ☑ <b>equipado</b>: bônus de armadura, escudo, itens mágicos e armas entram sozinhos nas defesas e ataques. Gasto total em itens: <b id="ouro-gasto">0</b> po.</p>
    <div class="d-flex gap-2 flex-wrap mb-3">
      <button class="btn-rpg-sec" id="add-armadura">＋ Armadura</button><button class="btn-rpg-sec" id="add-escudo">＋ Escudo</button><button class="btn-rpg-sec" id="add-arma">＋ Arma</button>
      <button class="btn-rpg-sec" id="add-impl">＋ Implemento</button><button class="btn-rpg-sec" id="add-item">＋ Item mágico (anel, capa, botas…)</button><button class="btn-rpg-mini" id="add-livre">＋ Item livre</button></div>
    <div id="lista-itens"></div></div>`;
  ligarCampos(c);
  const comprarBase = async (cat, filtros, titulo, escudo) => {
    escolher({ cats: [cat], titulo, filtros: { nivelMax: '', raridade: 'mundano', ...filtros }, onPick: async (m) => {
      const preco = parseFloat(String(Array.isArray(m.Cost) ? m.Cost[0] : m.Cost || '0').replace(/,/g, '')) || 0;
      const desconta = confirm(`${m.Name} custa ${po(preco)} po. Descontar do seu ouro (${po(P.ouro)} po)?`);
      if (desconta) P.ouro = (+P.ouro || 0) - preco;
      P.itens.push({ id: uid(), cat, nome: m.Name, qtd: 1, equipado: false, custo: preco, _escudo: !!escudo, base: { cat, id: m.ID, nome: m.Name }, ench: null });
      log('item', 'Comprou: ' + m.Name); agendarSalvar(); abaInventario();
    } });
  };
  $('#add-armadura').onclick = () => comprarBase('armor', { escudo: '0' }, 'Comprar armadura');
  $('#add-escudo').onclick = () => comprarBase('armor', { escudo: '1' }, 'Comprar escudo', true);
  $('#add-arma').onclick = () => comprarBase('weapon', {}, 'Comprar arma');
  $('#add-impl').onclick = () => comprarBase('implement', {}, 'Comprar implemento');
  $('#add-item').onclick = () => escolher({ cats: ['item'], titulo: 'Item mágico', aviso: `Mostrando itens até o nível ${P.nivel} do seu personagem (mude o limite abaixo para ver mais).`, filtros: { nivelMax: P.nivel }, onPick: async (m) => {
    const v = await escolherVariante('item', m.ID, m.Name); if (!v) return;
    P.itens.push({ id: uid(), cat: 'item', nome: m.Name, qtd: 1, equipado: false, custo: v.custo, variante: { mais: v.mais, nivel: v.nivel }, ref: { cat: 'item', id: m.ID } });
    log('item', `Comprou: ${m.Name}${v.mais ? ' +' + v.mais : ''}`); agendarSalvar(); abaInventario();
  } });
  $('#add-livre').onclick = () => { const n = prompt('Nome do item:'); if (n) { P.itens.push({ id: uid(), cat: 'livre', nome: n, qtd: 1, equipado: false }); agendarSalvar(); abaInventario(); } };

  const desenhar = () => {
    $('#lista-itens').innerHTML = P.itens.length ? P.itens.map((it) => {
      const nv = nivelDoItem(it), acima = nv > P.nivel;
      const pode = ['armor', 'weapon', 'implement'].includes(it.cat) && it.base?.id && !it.ench;
      return `<div class="lista-item" data-id="${it.id}"><input type="checkbox" class="form-check-input" data-eq title="Equipado (os bônus entram no cálculo)" ${it.equipado ? 'checked' : ''}>
        <span class="nm" data-ver>${esc(nomeItem(it))}</span>${it.ench?.id || it.ref?.id ? btnMacro(it.ench?.id || it.ref.id) : ''}
        ${it._escudo ? '<span class="tag">Escudo</span>' : ''}${it.cat === 'item' || it.ench ? '<span class="tag item">Mágico</span>' : ''}${nv ? `<small>nív. ${nv}</small>` : ''}${acima ? '<span class="tag" style="background:#f0b4a8">acima do seu nível</span>' : ''}
        ${it.custo ? `<small>${po(it.custo)} po</small>` : ''}
        ${pode ? '<button class="btn-rpg-mini" data-ench>✨ Encantar</button>' : ''}
        ${it.ench ? '<button class="btn-rpg-mini" data-desench title="Tirar o encantamento">Desencantar</button>' : ''}
        ${['weapon', 'implement'].includes(it.cat) && it.base?.id ? (it.augment ? `<span class="tag item" title="Augment encaixado">${esc(it.augment.nome)}</span><button class="btn-rpg-mini" data-desaug title="Tirar o augment">Tirar augment</button>` : '<button class="btn-rpg-mini" data-aug title="Encaixar um augment (Dragonshard)">💎 Augment</button>') : ''}
        <input type="number" class="form-control" style="width:4.2rem" min="0" data-q value="${it.qtd ?? 1}"><button class="btn-rpg-mini" data-rm>✕</button></div>`;
    }).join('') : '<p class="text-muted">Mochila vazia.</p>';
    $$('#lista-itens .lista-item').forEach((row) => {
      const it = P.itens.find((x) => x.id === row.dataset.id);
      $('[data-eq]', row).onchange = (e) => {
        it.equipado = e.target.checked;
        if (it.equipado && it.cat === 'armor') for (const o of P.itens) if (o !== it && o.cat === 'armor' && o.equipado && !!o._escudo === !!it._escudo) o.equipado = false; // 1 armadura e 1 escudo por vez
        agendarSalvar(); desenhar(); recalcular();
      };
      $('[data-q]', row).oninput = (e) => { it.qtd = +e.target.value; agendarSalvar(); };
      $('[data-rm]', row).onclick = () => {
        if (it.custo && confirm(`Devolver ${po(it.custo)} po ao ouro (venda pelo preço cheio)?`)) { P.ouro = (+P.ouro || 0) + it.custo; $('[data-bind=ouro]').value = P.ouro; }
        P.itens = P.itens.filter((x) => x !== it); agendarSalvar(); desenhar(); recalcular();
      };
      $('[data-ver]', row).onclick = () => { const r = it.ench?.id ? { cat: it.ench.cat, id: it.ench.id } : it.ref?.id ? it.ref : it.base?.id ? it.base : null; if (r) abrirLeitor(r.cat, r.id); };
      const enc = $('[data-ench]', row);
      if (enc) enc.onclick = () => escolher({ cats: [it.cat], titulo: `Encantar: ${it.base.nome}`, aviso: `Só aparecem encantamentos compatíveis com ${esc(it.base.nome)} até o nível ${P.nivel}.`,
        filtros: { raridade: 'magico', nivelMax: P.nivel, baseCat: it.cat, baseId: it.base.id }, onPick: async (m) => {
          const v = await escolherVariante(it.cat, m.ID, m.Name, { rotuloOk: 'Encantar' }); if (!v) return;
          it.ench = { cat: it.cat, id: m.ID, nome: m.Name, mais: v.mais, nivel: v.nivel }; it.custo = (it.custo || 0) + v.custo;
          log('item', `Encantou ${it.base.nome}: ${m.Name} +${v.mais}`); agendarSalvar(); desenhar(); recalcular(); if ($('[data-bind=ouro]')) $('[data-bind=ouro]').value = P.ouro;
        } });
      const aug = $('[data-aug]', row);
      if (aug) aug.onclick = () => escolher({ cats: ['weapon'], titulo: `Augment para: ${nomeItem(it)}`, aviso: 'Augments (Dragonshard) encaixam na arma ou implemento e dão o bônus só a ela.',
        filtros: { tipo: 'dragonshard', nivelMax: P.nivel }, onPick: async (m) => {
          const v = await escolherVariante('weapon', m.ID, m.Name, { rotuloOk: 'Encaixar' }); if (!v) return;
          it.augment = { cat: 'weapon', id: m.ID, nome: m.Name, nivel: v.nivel }; it.custo = (it.custo || 0) + v.custo;
          log('item', `Encaixou ${m.Name} em ${nomeItem(it)}`); agendarSalvar(); desenhar(); recalcular(); if ($('[data-bind=ouro]')) $('[data-bind=ouro]').value = P.ouro;
        } });
      const daug = $('[data-desaug]', row);
      if (daug) daug.onclick = () => { it.augment = null; agendarSalvar(); desenhar(); recalcular(); };
      const des = $('[data-desench]', row);
      if (des) des.onclick = () => { it.ench = null; agendarSalvar(); desenhar(); recalcular(); };
    });
  };
  desenhar();
}

// ------------------------------------------------------------ anotações
function novaNota(titulo) {
  const agora = new Date().toISOString();
  return { id: uid(), titulo, texto: '', criado: agora, editado: agora, janela: { x: 80 + Math.random() * 160, y: 110 + Math.random() * 90, w: 440, h: 340, aberta: true, min: false }, versoes: [] };
}
function abaNotas() {
  const c = $('#conteudo-aba');
  c.innerHTML = `<div class="folha"><div class="d-flex gap-2 flex-wrap align-items-center mb-2"><h2 class="flex-grow-1 mb-0">Janelas de anotações</h2>
    <button class="btn-rpg" id="nova-nota">＋ Nova janela de anotações</button></div>
    <p class="text-muted">Cada janela é um bloco de notas separado, com nome editável. Elas ficam flutuando por cima da tela (arraste, redimensione, minimize) e tudo é salvo sozinho no histórico do personagem.</p>
    <div class="row g-2">${P.notas.map((n) => `<div class="col-md-6 col-lg-4"><div class="folha h-100" style="padding:.7rem .9rem"><div class="d-flex gap-2"><b class="flex-grow-1 titulo" style="color:var(--sangue)">${esc(n.titulo)}</b>
      <button class="btn-rpg-mini" data-abrir="${n.id}">${n.janela?.aberta ? 'Trazer' : 'Abrir'}</button><button class="btn-rpg-mini" data-excl="${n.id}">🗑</button></div>
      <div class="rotulo">editado ${dataBR(n.editado)} · ${(n.texto || '').length} caract.</div>
      <div style="max-height:4.6rem;overflow:hidden;white-space:pre-wrap;font-size:.95rem">${esc((n.texto || '').slice(0, 220))}</div></div></div>`).join('')}</div></div>`;
  $('#nova-nota').onclick = () => {
    const n = prompt('Nome da janela de anotações:', 'Nova anotação'); if (!n) return;
    const nota = novaNota(n); P.notas.push(nota); log('nota', `Janela criada: ${n}`); agendarSalvar(); abrirJanelaNota(nota.id); abaNotas();
  };
  $$('[data-abrir]').forEach((b) => b.onclick = () => abrirJanelaNota(b.dataset.abrir));
  $$('[data-excl]').forEach((b) => b.onclick = () => {
    const n = P.notas.find((x) => x.id === b.dataset.excl);
    if (!confirm(`Excluir a janela "${n.titulo}" e todo o texto?`)) return;
    P.notas = P.notas.filter((x) => x !== n); $(`.jan-nota[data-id="${n.id}"]`)?.remove(); log('nota', `Janela excluída: ${n.titulo}`); agendarSalvar(); abaNotas();
  });
}

let zTopo = 10;
function abrirJanelaNota(id) {
  const n = P.notas.find((x) => x.id === id); if (!n) return;
  n.janela = n.janela || { x: 100, y: 120, w: 440, h: 340, aberta: true, min: false };
  n.janela.aberta = true;
  let el = $(`.jan-nota[data-id="${id}"]`);
  if (el) { el.style.zIndex = ++zTopo; el.classList.remove('min'); n.janela.min = false; agendarSalvar(); return; }
  const j = n.janela;
  el = document.createElement('div');
  el.className = 'jan-nota' + (j.min ? ' min' : '');
  el.dataset.id = id;
  Object.assign(el.style, { left: Math.min(j.x, innerWidth - 120) + 'px', top: Math.max(60, Math.min(j.y, innerHeight - 80)) + 'px', width: j.w + 'px', height: j.h + 'px', zIndex: ++zTopo });
  el.innerHTML = `<header><span>📜</span><input value="${esc(n.titulo)}" title="Clique para renomear"><button data-h title="Versões anteriores">🕰</button><button data-m title="Minimizar">—</button><button data-x title="Fechar (o texto fica salvo)">✕</button></header>
    <textarea placeholder="Escreva aqui…" spellcheck="true"></textarea><footer><span data-info></span><span>salva sozinho</span></footer>`;
  $('#janelas').append(el);
  const ta = $('textarea', el), tit = $('header input', el), info = $('[data-info]', el);
  ta.value = n.texto || '';
  const atualizaInfo = () => { info.textContent = `${ta.value.length} caract. · editado ${dataBR(n.editado)}`; };
  atualizaInfo();
  const snapshot = () => {
    const ult = n.versoes[n.versoes.length - 1];
    if (!ult || Date.now() - Date.parse(ult.quando) > 180000) { n.versoes.push({ quando: new Date().toISOString(), titulo: n.titulo, texto: n.texto }); if (n.versoes.length > 40) n.versoes.shift(); }
  };
  ta.oninput = () => { snapshot(); n.texto = ta.value; n.editado = new Date().toISOString(); atualizaInfo(); agendarSalvar(); };
  tit.oninput = () => { n.titulo = tit.value; n.editado = new Date().toISOString(); agendarSalvar(); };
  tit.onchange = () => log('nota', `Janela renomeada: ${n.titulo}`);
  tit.onmousedown = (e) => e.stopPropagation();
  el.onmousedown = () => { el.style.zIndex = ++zTopo; };
  $('[data-x]', el).onclick = () => { n.janela.aberta = false; el.remove(); agendarSalvar(); if (aba === 'notas') abaNotas(); };
  $('[data-m]', el).onclick = () => { n.janela.min = !n.janela.min; el.classList.toggle('min', n.janela.min); agendarSalvar(); };
  $('[data-h]', el).onclick = () => {
    const velho = $('.hist-versoes', el); if (velho) return velho.remove();
    const box = document.createElement('div'); box.className = 'hist-versoes';
    box.innerHTML = n.versoes.length ? [...n.versoes].reverse().map((v, i) => `<div data-v="${n.versoes.length - 1 - i}"><b>${dataBR(v.quando)}</b><br>${esc((v.texto || '').slice(0, 70)) || '(vazio)'}</div>`).join('') : '<div>Sem versões anteriores ainda.</div>';
    el.append(box);
    $$('[data-v]', box).forEach((d) => d.onclick = () => { const v = n.versoes[+d.dataset.v]; if (!confirm('Voltar o texto para esta versão? (o atual vira uma versão)')) return; n.versoes.push({ quando: new Date().toISOString(), titulo: n.titulo, texto: n.texto }); n.texto = v.texto; ta.value = v.texto; n.editado = new Date().toISOString(); atualizaInfo(); agendarSalvar(); box.remove(); });
  };
  $('header', el).onpointerdown = (e) => {
    if (e.target.closest('button, input')) return;
    const dx = e.clientX - el.offsetLeft, dy = e.clientY - el.offsetTop;
    const mover = (ev) => { el.style.left = Math.max(-200, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; el.style.top = Math.max(50, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; };
    const soltar = () => { removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); n.janela.x = el.offsetLeft; n.janela.y = el.offsetTop; agendarSalvar(); };
    addEventListener('pointermove', mover); addEventListener('pointerup', soltar);
  };
  new ResizeObserver(() => { if (!n.janela.min && el.offsetWidth > 50) { if (Math.abs(n.janela.w - el.offsetWidth) > 2 || Math.abs(n.janela.h - el.offsetHeight) > 2) { n.janela.w = el.offsetWidth; n.janela.h = el.offsetHeight; agendarSalvar(); } } }).observe(el);
  agendarSalvar();
  if (!j.min) ta.focus();
}

// ------------------------------------------------------------ histórico
function abaHistorico() {
  const ev = [...P.historico.map((h) => ({ q: h.quando, t: h.texto, tipo: h.tipo })),
    ...P.notas.map((n) => ({ q: n.editado, t: `Anotação "${n.titulo}" editada (${(n.texto || '').length} caracteres)`, tipo: 'nota', nid: n.id })),
    ...P.notas.flatMap((n) => n.versoes.map((v) => ({ q: v.quando, t: `Versão salva de "${v.titulo}"`, tipo: 'versao', nid: n.id })))]
    .sort((a, b) => b.q.localeCompare(a.q)).slice(0, 300);
  $('#conteudo-aba').innerHTML = `<div class="folha"><h2>Histórico de ${esc(P.nome)}</h2>
    <p class="text-muted">Criado em ${dataBR(P.criado)}. Tudo o que você anota e muda fica registrado aqui.</p>
    <div class="linha-tempo">${ev.map((e) => `<div class="ev"><div class="quando">${dataBR(e.q)}</div><div>${esc(e.t)} ${e.nid ? `<button class="btn-rpg-mini" data-abrir="${e.nid}">abrir</button>` : ''}</div></div>`).join('')}</div></div>`;
  $$('[data-abrir]').forEach((b) => b.onclick = () => abrirJanelaNota(b.dataset.abrir));
}

// ============================================================ grimório (poderes em janela grande)
const gr = { filtro: 'todos', dets: [] };
async function abrirGrimorio(abrirModal = true) {
  $('#gr-nome').textContent = P.nome;
  $('#gr-corpo').innerHTML = '<div class="carregando"><span class="spin"></span> Reunindo os poderes…</div>';
  if (abrirModal !== false) modal('grimorio').show();
  const entradas = [
    ...P.poderes.map((w) => ({ cat: 'power', id: w.id, nome: w.nome, grupo: grupoDoPoder(w), util: ehUtil(w), nivel: +w.nivel || 0 })),
    ...P.itens.flatMap((i) => [i.ench?.id && { cat: i.ench.cat, id: i.ench.id, nome: nomeItem(i) }, i.cat === 'item' && i.ref?.id && { cat: 'item', id: i.ref.id, nome: nomeItem(i) }].filter(Boolean))
      .map((e) => ({ ...e, grupo: 'item', util: false, nivel: 0 })),
  ];
  gr.dets = await Promise.all(entradas.map(async (e) => {
    if (!e.id) return { ...e, det: null };
    try { return { ...e, det: await getDet(e.cat, e.id) }; } catch { return { ...e, det: null }; }
  }));
  gr.stats = await statsDosPoderes(entradas.filter((e) => e.cat === 'power' && e.id).map((e) => e.id));
  desenharGrimorio();
}
function desenharGrimorio() {
  const filtros = [['todos', 'Todos'], ['atwill', 'Sem limite'], ['encounter', 'Encontro'], ['daily', 'Diários'], ['util', 'Utilitários'], ['item', 'Itens']];
  $('#gr-filtros').innerHTML = filtros.map(([k, n]) => `<button class="filtro ${gr.filtro === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('');
  $$('#gr-filtros [data-f]').forEach((b) => b.onclick = () => { gr.filtro = b.dataset.f; desenharGrimorio(); });
  const visivel = (e) => gr.filtro === 'todos' || gr.filtro === e.grupo || (gr.filtro === 'util' && e.util);
  const secoes = GRUPOS.map(([g, nome]) => ({ g, nome, lista: gr.dets.filter((e) => e.grupo === g && visivel(e)).sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome)) })).filter((s) => s.lista.length);
  $('#gr-modo').textContent = IDIOMA === 'pt' ? 'Texto: Português (clique para ver o original)' : 'Texto: Original (clique para ver em português)';
  $('#gr-corpo').innerHTML = secoes.length ? secoes.map((s) => `<div class="secao-poder"><h4>${s.nome} (${s.lista.length})</h4><div class="grade-cartas">${s.lista.map((e) => e.det
    ? `<div class="carta-pod">${htmlCarta(e.det)}${e.cat === 'power' ? htmlStatsSheet(gr.stats?.[e.id]) : ''}</div>`
    : `<div class="carta-pod"><div class="carta"><h1>${esc(e.nome)}</h1><div class="corpo"><i>Sem texto no compêndio.</i></div></div></div>`).join('')}</div></div>`).join('')
    : '<div class="carregando">Nenhum poder neste filtro. Adicione poderes na aba "Poderes".</div>';
}
$('#gr-modo').onclick = () => { $('#btn-idioma').click(); };

// zoom dos cartões do grimório (cada pessoa ajusta para o seu monitor; vale no modal e na janela separada)
let grZoom = +localStorage.getItem('grZoom') || 100;
function aplicarZoomGr() {
  grZoom = Math.min(250, Math.max(50, Math.round(grZoom)));
  try { localStorage.setItem('grZoom', grZoom); } catch { /* sem armazenamento */ }
  $('#gr-corpo').style.zoom = grZoom / 100;
  $('#gr-zv').textContent = grZoom + '%';
}
$('#gr-zm').onclick = () => { grZoom -= 10; aplicarZoomGr(); };
$('#gr-zp').onclick = () => { grZoom += 10; aplicarZoomGr(); };
$('#gr-z0').onclick = () => { grZoom = 100; aplicarZoomGr(); };
$('#gr-corpo').addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); grZoom += e.deltaY < 0 ? 10 : -10; aplicarZoomGr(); } }, { passive: false });
aplicarZoomGr();
// janela separada: a mesma tela do grimório numa janela do navegador, com rolagem e zoom próprios
$('#gr-janela').onclick = () => {
  const w = window.open('/?grimorio=' + encodeURIComponent(P.id), 'grimorio-' + P.id, 'width=1400,height=900,resizable=yes,scrollbars=yes');
  if (w) { w.focus(); modal('grimorio').hide(); } else toast('O navegador bloqueou a janela. Permita pop-ups para este endereço.', true);
};
const GRIM_ID = new URLSearchParams(location.search).get('grimorio');
async function abrirGrimorioPagina(id) {
  document.body.classList.add('gr-pagina');
  const mc = $('#grimorio .modal-content');
  const pag = document.createElement('div'); pag.id = 'gr-pagina'; pag.appendChild(mc); document.body.appendChild(pag);
  $('#gr-janela').classList.add('invisivel'); $('#gr-atualizar').classList.remove('invisivel');
  mc.querySelector('[data-bs-dismiss]')?.classList.add('invisivel');
  const carregar = async () => {
    $('#gr-corpo').innerHTML = '<div class="carregando"><span class="spin"></span> Reunindo os poderes…</div>';
    try { P = await api('/api/personagens/' + id); } catch { $('#gr-corpo').innerHTML = '<div class="carregando">Não encontrei esta ficha.</div>'; return; }
    document.title = 'Grimório · ' + P.nome;
    await abrirGrimorio(false);
  };
  $('#gr-atualizar').onclick = carregar;
  await carregar();
}

// ============================================================ configurações
$('#btn-config').onclick = async () => {
  modal('modalConfig').show();
  const alvo = $('#cfg-corpo');
  alvo.innerHTML = '<div class="carregando">…</div>';
  const comp = await api('/api/comp/status');
  const total = Object.values(comp.categorias).reduce((a, c) => a + c.itens, 0);
  alvo.innerHTML = `
    <h4>Compêndio (fonte: iws.mx / 4e Database)</h4>
    <p>${total.toLocaleString('pt-BR')} entradas guardadas no seu computador: ${Object.values(comp.categorias).filter((c) => c.itens).map((c) => `${c.titulo} ${c.itens}`).join(' · ')}.</p>
    <p>${comp.traduzidos.toLocaleString('pt-BR')} trechos já traduzidos para português (nomes ficam sempre no original, com a tradução entre parênteses). A busca funciona em inglês e em português, em nomes e dentro dos textos.</p>
    <button class="btn-rpg-mini" id="cfg-comp">${comp.atualizando ? 'Atualizando…' : 'Baixar/atualizar compêndio do iws.mx'}</button>
    <p class="rotulo mt-3">Seus dados ficam na pasta <b>dados\\</b> deste programa. Tudo funciona sem login e sem internet (só baixar o compêndio precisa). Importa .dnd4e, .json e PDF com campos de formulário, como o que o próprio app exporta.</p>`;
  $('#cfg-comp').onclick = () => { if (confirm('Baixar de novo o compêndio do iws.mx (alguns minutos)?')) { baixarCompendio(); toast('Baixando em segundo plano…'); } };
};

// ============================================================ início
addEventListener('beforeunload', () => { if (P && !GRIM_ID) navigator.sendBeacon?.('/api/personagens/' + P.id, new Blob([JSON.stringify(P)], { type: 'application/json' })); });
// atualizações (Releases do GitHub): botão discreto "↻"; se houver versão nova vira "Baixar atualização"
const TXT_ATU = { pt: { verificar: 'Verificar atualizações', atual: 'Você já está na versão mais recente', baixar: 'Baixar atualização', baixando: 'Baixando e instalando… o Grimório vai reiniciar', erro: 'Não foi possível verificar agora', indisp: 'Atualizações indisponíveis (repositório ainda não é público)', nova: 'Versão' },
  en: { verificar: 'Check for updates', atual: 'You are on the latest version', baixar: 'Download update', baixando: 'Downloading and installing… Grimoire will restart', erro: 'Could not check right now', indisp: 'Updates unavailable (repository is not public yet)', nova: 'Version' } };
let atuNova = null;
async function verificarAtualizacao(manual) {
  const b = $('#btn-atualizar'), t = TXT_ATU[IDIOMA];
  try {
    const v = await api('/api/versao' + (manual ? '?forcar=1' : ''));
    if (v.ok && v.nova) { atuNova = v; b.textContent = '⬇ ' + t.baixar + ' v' + v.ultima; b.title = (v.notas || '').slice(0, 300); b.classList.add('btn-rpg'); b.classList.remove('btn-discreto', 'btn-rpg-sec'); }
    else if (manual) toast(v.ok ? t.atual + ' (v' + v.atual + ')' : (v.motivo === 'sem-release' ? t.indisp : t.erro), !v.ok);
  } catch { if (manual) toast(t.erro, true); }
}
function ligarAtualizacao() {
  const b = $('#btn-atualizar');
  b.onclick = async () => {
    const t = TXT_ATU[IDIOMA];
    if (!atuNova) { b.disabled = true; await verificarAtualizacao(true); b.disabled = false; return; }
    if (!confirm(t.baixar + ' v' + atuNova.ultima + '?\n\n' + (atuNova.notas || ''))) return;
    b.disabled = true; toast(t.baixando, false, 20000);
    try { await api('/api/atualizar', { method: 'POST' }); setTimeout(() => location.reload(), 12000); } catch (e) { b.disabled = false; toast(e.message || t.erro, true); }
  };
  setTimeout(() => verificarAtualizacao(false), 2500); // verificação silenciosa ao abrir
}

ligarIdioma();
ligarAtualizacao();
if (GRIM_ID) abrirGrimorioPagina(GRIM_ID); else desenharHome();

// ============================================================ segurança dos dados (pasta, backup total, restaurar, lixeira)
async function rodapeDados(el) {
  let info = {};
  try { info = await api('/api/dados-info'); } catch { return; }
  el.insertAdjacentHTML('beforeend', `<div class="folha mt-4"><h3>🛡 Seus dados</h3>
    <p class="rotulo mb-2">As fichas ficam em <b>${esc(info.pasta)}</b> (${info.total} arquivos). Cada ficha grava sozinha a cada alteração e há cópias de segurança em <b>dados\backups</b>. Se abrir o programa e a ficha não estiver aqui, confira se está usando a mesma pasta do programa.</p>
    <button class="btn-rpg-sec btn-sm" id="bk-total">💾 Backup de tudo (.json)</button>
    <label class="btn-rpg-sec btn-sm m-0">📂 Restaurar backup<input type="file" id="bk-rest" accept=".json" hidden></label>
    <button class="btn-rpg-sec btn-sm" id="bk-lixeira">🗑 Lixeira</button><div id="lixeira-lista" class="mt-2"></div></div>`);
  $('#bk-total').onclick = async () => {
    const d = await api('/api/backup-total');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }));
    a.download = 'grimorio-backup-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json'; a.click();
  };
  $('#bk-rest').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await api('/api/restaurar-total', { method: 'POST', body: JSON.parse(await f.text()) }); toast(r.restauradas + ' fichas restauradas.'); desenharHome(); }
    catch (er) { toast('Falhou: ' + esc(er.message), true); }
  };
  $('#bk-lixeira').onclick = async () => {
    const l = await api('/api/lixeira'); const box = $('#lixeira-lista');
    box.innerHTML = l.length ? l.map((x) => `<div class="d-flex gap-2 align-items-center mb-1"><span class="flex-grow-1">${esc(x.nome)} · nível ${x.nivel} · ${x.notas} anotações · ${dataBR(x.atualizado)}</span><button class="btn-rpg-mini" data-rest="${esc(x.arquivo)}">Restaurar</button></div>`).join('') : '<span class="rotulo">Lixeira vazia.</span>';
    $$('[data-rest]', box).forEach((b) => b.onclick = async () => { await api('/api/lixeira/restaurar', { method: 'POST', body: { arquivo: b.dataset.rest } }); toast('Restaurado.'); desenharHome(); });
  };
}
