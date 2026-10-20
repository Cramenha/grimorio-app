// Exporta a ficha para o Roll20: um .json com os valores JÁ CALCULADOS nos campos da ficha "D&D 4E" do Roll20
// (nomes dos campos conferidos no sheet oficial: github.com/Roll20/roll20-character-sheets/D&D_4E) e as macros de
// poderes, talentos e itens. Quem lê esse arquivo é o script roll20\grimorio-importador.js (API do Roll20, plano Pro).
import * as comp from './compendio.mjs';
import { calcular, infoArma, PERICIAS, PENALIZA } from './calculo.mjs';
import * as r20 from './roll20.mjs';
import { calculatePowerStats, bonusDaArma } from './poder-stats.mjs';
import { maximoDosDados } from './efeitos-ficha.mjs';

const mod = (n) => Math.floor((n - 10) / 2);
const ATR_FICHA = { for: 'strength', con: 'constitution', des: 'dexterity', int: 'intelligence', sab: 'wisdom', car: 'charisma' };
const bi = (nome) => { const pt = nome && comp.nomePT(nome); return pt && pt.toLowerCase() !== nome.toLowerCase() ? `${nome} (${pt})` : (nome || ''); };
const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const nomeHabilidade = (s) => semAcento(s).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const nomeItem = (it) => (it.base && it.ench ? `${it.base.nome} · ${it.ench.nome}${it.ench.mais ? ' +' + it.ench.mais : ''}` : it.cat === 'item' && it.variante?.mais ? `${it.nome} +${it.variante.mais}` : it.nome);

// Efeitos condicionais e específicos do poder nas macros do Roll20 (vindos de calculatePowerStats, a mesma fonte das telas):
//  - pergunta Sim/Não ("Alvo derrubado?") dentro do ataque ou do dano: ?{Pergunta|Não,0|Sim,5} (dado também vale: Sim,1d8); só soma se responder Sim
//  - bônus fixo que depende do poder (palavra-chave, tipo de poder…) e dano extra em dados que sempre vale: somados direto
//  - dano extra de acerto crítico: somado na linha de crítico
//  - o que o aplicativo não sabe responder: linha informativa, fora do cálculo
// Roll query: o texto da pergunta não pode ter barra vertical, chaves ou colchetes.
const limpa = (t) => String(t).replace(/[|{}[\]]/g, ' ').replace(/\s+/g, ' ').trim();
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const valorTxt = (c) => (c.dice || String(c.value));
const maxTxt = (c) => (c.dice ? String(maximoDosDados(c.dice)) : String(c.value));
function pergunta(c, lang, critico) {
  const pt = lang === 'pt';
  const cond = pt ? (c.conditionPt || maiuscula(c.condition) + '?') : maiuscula(c.condition) + '?';
  return `?{${limpa(cond)} - ${limpa(c.source)}|${pt ? 'Não' : 'No'},0|${pt ? 'Sim' : 'Yes'},${critico ? maxTxt(c) : valorTxt(c)}}`;
}
// insere um termo no fim da conta de uma linha da macro ("{{damage=[[ ... ]] de dano" / "{{attack=[[ ... ]] vs")
function inserir(m, tag, termo) {
  const i = m.indexOf('{{' + tag + '=[[ ');
  if (i < 0) return m;
  const fim = tag === 'attack' ? ' ]] vs' : ' ]] de dano';
  const j = m.indexOf(fim, i);
  return j > 0 ? m.slice(0, j) + ' + ' + termo + m.slice(j) : m;
}
function textoInfo(c, pt) {
  const num = c.value != null && !c.dice ? (c.value >= 0 ? '+' : '') + c.value : (c.dice || '');
  const nota = !num && c.note ? ': ' + limpa(c.note).slice(0, 140) : ''; // sem número: a nota explica de que depende o valor
  const quando = limpa((pt && c.conditionPt) || c.condition || c.note) + nota;
  return `${c.appliesTo === 'attack' ? (pt ? 'ataque' : 'attack') : (pt ? 'dano' : 'damage')} ${num} (${quando}) - ${limpa(c.source)}`.replace(/\s+/g, ' ');
}
function comEfeitos(macro, res, lang) {
  if (!res) return macro;
  const pt = lang === 'pt';
  let m = macro;
  // fixos que dependem do poder (os que não dependem já estão nos campos weapon-N) e dano extra em dados
  for (const l of res.attackBreakdown || []) if (l.applied && l.powerSpecific && l.value) m = inserir(m, 'attack', `${l.value} [${limpa(l.source)}]`);
  for (const l of res.damageBreakdown || []) {
    if (!l.applied || (!l.powerSpecific && !l.dice)) continue;
    if (l.dice) { m = inserir(m, 'damage', `${l.dice} [${limpa(l.source)}]`); m = inserir(m, 'critical', `${maximoDosDados(l.dice)} [${limpa(l.source)} max]`); }
    else if (l.value) { m = inserir(m, 'damage', `${l.value} [${limpa(l.source)}]`); m = inserir(m, 'critical', `${l.value} [${limpa(l.source)}]`); }
  }
  const info = [];
  let perguntas = 0;
  for (const c of res.conditionalModifiers || []) {
    // no máximo 5 perguntas por poder (muitas caixas atrapalham a rolagem); o resto vira linha informativa
    const pergunta5 = (c.kind === 'ask' || (c.kind === 'critical' && c.critAsk)) && perguntas++ >= 5;
    if (pergunta5) info.push(textoInfo(c, pt));
    else if (c.kind === 'ask' && c.appliesTo === 'attack') m = inserir(m, 'attack', pergunta(c, lang, false));
    else if (c.kind === 'critical' && c.critAsk) m = inserir(m, 'critical', pergunta(c, lang, false));
    else if (c.kind === 'ask') { m = inserir(m, 'damage', pergunta(c, lang, false)); m = inserir(m, 'critical', pergunta(c, lang, true)); }
    else if (c.kind === 'critical') m = inserir(m, 'critical', `${valorTxt(c)} [${limpa(c.source)} crit]`);
    else info.push(textoInfo(c, pt));
  }
  if (info.length) m += ` {{**${pt ? 'Condicionais (não calculados)' : 'Conditionals (not calculated)'}:**=${info.join('. ')}.}}`;
  return m;
}

// Divide os bônus de uma defesa nas colunas da ficha (habilidade, armadura, classe, talento, aprimoramento, misc).
function defesa(C, chave, p, habs) {
  const total = C[chave], meia = Math.floor(C.nivel / 2);
  let armor = 0, enh = 0, feat = 0, misc = 0;
  for (const l of C.origem[chave].filter((x) => x.aplicado)) {
    const t = (l.tipo || '').toLowerCase();
    if (t === 'armor' || t === 'shield') armor += l.valor; else if (t === 'enhancement') enh += l.valor; else if (t === 'feat') feat += l.valor; else misc += l.valor;
  }
  let hab = Math.max(...habs.map((a) => C.modificadores[a]));
  let classe = total - 10 - meia - hab - armor - enh - feat - misc;
  if (classe < 0 && chave === 'ac') { hab = 0; classe = total - 10 - meia - armor - enh - feat - misc; } // armadura pesada: sem bônus de atributo
  return { [`${p}-ability`]: hab, [`${p}-armor`]: armor, [`${p}-class`]: classe, [`${p}-feat`]: feat, [`${p}-enh`]: enh, [`${p}-misc`]: misc, [`${p}-misc2`]: 0 };
}

export function exportarRoll20(P, lang = 'pt') {
  const C = calcular(P);
  const meia = Math.floor(C.nivel / 2);
  const avisos = [];
  const A = {};
  const set = (k, v) => { if (v !== undefined && v !== null && v !== '') A[k] = v; };

  set('character_name', P.nome); set('level', C.nivel); set('xp', P.xp);
  set('class', bi(P.classe?.nome)); set('race', bi(P.raca?.nome)); set('paragon', bi(P.paragon?.nome)); set('epic', bi(P.destino?.nome));
  set('deity', bi(P.divindade?.nome)); set('alignment', P.tendencia); set('size', P.tamanho); set('gender', P.genero);
  set('age', P.idade); set('height', P.altura); set('weight', P.peso); set('lang', P.idiomas);
  for (const k of Object.keys(ATR_FICHA)) set(ATR_FICHA[k], C.atributos[k]);

  // defesas, PV, surtos, iniciativa, velocidade
  Object.assign(A, defesa(C, 'ac', 'ac', ['des', 'int']), defesa(C, 'fort', 'fort', ['for', 'con']), defesa(C, 'ref', 'ref', ['des', 'int']), defesa(C, 'vont', 'will', ['sab', 'car']));
  A.hp = { c: P.pvAtual === '' || P.pvAtual == null ? C.pv : +P.pvAtual, m: C.pv };
  A['hp-bloodied'] = Math.floor(C.pv / 2);
  A.surges = { c: P.surtosAtuais === '' || P.surtosAtuais == null ? C.surtos : +P.surtosAtuais, m: C.surtos };
  A['surge-value'] = C.valorSurto; A['surge-value-bonus'] = 0;
  A['init-highest'] = '@{dexterity-mod}';
  A['init-feat'] = 0; A['init-item'] = 0; A['init-misc'] = C.iniciativa - C.modificadores.des - meia;
  const velArm = C.origem.velocidade.filter((l) => /^Armadura/i.test(l.fonte)).reduce((a, l) => a + l.valor, 0);
  const velItem = C.origem.velocidade.filter((l) => (l.tipo || '').toLowerCase() === 'item').reduce((a, l) => a + l.valor, 0);
  A['speed-base'] = C.velocidade - velArm - velItem; A['speed-armor'] = velArm; A['speed-item'] = velItem; A['speed-misc'] = 0;

  // perícias: a ficha soma modificador + metade do nível + 5 se treinada + penalidade + misc
  for (const [nome, ab] of PERICIAS) {
    const k = nome.toLowerCase(), tr = P.pericias?.[nome]?.treinada ? 1 : 0, pen = PENALIZA.has(nome) ? C.penalidadeArmadura : 0;
    A[`${k}-trained`] = tr; A[`${k}-pen`] = pen; A[`${k}-misc`] = C.pericias[nome] - (C.modificadores[ab] + meia + tr * 5 + pen);
  }

  // armas equipadas (a ficha tem 6 espaços; as macros usam o weapon-1)
  const armasEq = (P.itens || []).filter((x) => x.equipado && x.cat === 'weapon' && x.base?.id && infoArma('weapon', x.base.id));
  C.ataques.slice(0, 6).forEach((a, i) => {
    const n = i + 1, d = /(\d+)d(\d+)/.exec(a.dano || '') || [, 1, 6];
    set(`weapon-${n}-name`, a.nome); A[`weapon-${n}-num-dice`] = +d[1]; A[`weapon-${n}-dice`] = +d[2];
    A[`weapon-${n}-prof`] = 0; A[`weapon-${n}-enh`] = a.mais || 0; A[`weapon-${n}-per-plus`] = 6; A[`weapon-${n}-wielded`] = 1;
    const item = armasEq[i]; // C.ataques segue a mesma ordem das armas equipadas com texto no compêndio
    const b = item ? bonusDaArma(P, item, C) : { attackMisc: a.extraAtq || 0, damageMisc: a.extraDano || 0, prof: a.prof || 0 };
    A[`weapon-${n}-prof`] = b.prof ?? (a.prof || 0); A[`weapon-${n}-attack-misc`] = b.attackMisc; A[`weapon-${n}-damage-misc`] = b.damageMisc;
  });
  // implementos equipados entram nos espaços seguintes (as macros de implemento também leem weapon-1)
  let espaco = Math.min(C.ataques.length, 6);
  for (const it of (P.itens || []).filter((i) => i.equipado && i.cat === 'implement')) {
    if (espaco >= 6) break;
    espaco++;
    set(`weapon-${espaco}-name`, nomeItem(it)); A[`weapon-${espaco}-num-dice`] = 1; A[`weapon-${espaco}-dice`] = 6; A[`weapon-${espaco}-prof`] = 0;
    A[`weapon-${espaco}-enh`] = it.ench?.mais || 0; A[`weapon-${espaco}-per-plus`] = 6; A[`weapon-${espaco}-wielded`] = 1;
    A[`weapon-${espaco}-attack-misc`] = 0; A[`weapon-${espaco}-damage-misc`] = 0;
    if (espaco > 1) avisos.push(`Implemento "${nomeItem(it)}" ficou em weapon-${espaco}; as macros de implemento leem weapon-1 (troque os campos no Roll20 se for o seu foco principal).`);
  }
  if (!espaco) avisos.push('Nenhuma arma ou implemento equipado: os campos de arma ficam em branco (as macros usam weapon-1).');
  set('inventory-gold', P.ouro);

  // poderes -> os 100 espaços "Power N" da ficha (com a macro pronta); o excedente vira habilidade
  const poderes = [], habilidades = [];
  const macroTexto = (cat, id) => { try { return r20.gerarMacros(cat, id, lang); } catch { return null; } };
  for (const w of P.poderes.filter((x) => x.id)) {
    const m = macroTexto('power', w.id), info = r20.resumoPoder(w.id, lang);
    if (!m || !info) continue;
    let macroPoder = m.macros[0].macro;
    try { macroPoder = comEfeitos(macroPoder, calculatePowerStats(P, w, C)?.results?.[0], lang); } catch { /* sem texto do poder */ }
    const item = { nome: w.nome, acao: info.acao, alcance: info.alcance, nivel: info.nivel || String(w.nivel || ''), uso: info.uso, macro: macroPoder };
    if (poderes.length < 100) poderes.push(item); else habilidades.push({ nome: nomeHabilidade('Poder-' + w.nome), macro: item.macro });
    if (m.avisos.length) avisos.push(`${w.nome}: ${m.avisos[0]}`);
  }
  const condicionais = new Map();
  for (const w of P.poderes.filter((x) => x.id)) {
    try { for (const x of calculatePowerStats(P, w, C)?.results || []) for (const c of x.conditionalModifiers) condicionais.set(c.source + c.condition + c.appliesTo + (c.dice || c.value), c); } catch { /* poder sem texto */ }
  }
  // lista de referência com todos os efeitos condicionais da ficha (as macros dos poderes já trazem as perguntas e a linha informativa)
  if (condicionais.size) habilidades.push({ nome: 'Efeitos-Adicionais', macro: '&{template:dnd4epower} {{other=1}} {{name=' + (lang === 'pt' ? 'Efeitos adicionais' : 'Additional effects') + '}} {{effect=' + [...condicionais.values()].map((c) => textoInfo(c, lang === 'pt') + (c.kind === 'ask' ? (lang === 'pt' ? ' [pergunta na macro]' : ' [asked in the macro]') : '')).join('. ') + '.}}' });
  // talentos e itens equipados -> habilidades (ações da ficha) e linhas de texto
  const talentos = [], classeFeats = [], racaFeats = [], inventario = [];
  for (const t of P.talentos.filter((x) => x.id)) {
    const m = macroTexto('feat', t.id);
    const efeito = m && (/\{\{effect=([\s\S]*?)\}\}/.exec(m.macros[0].macro) || [])[1];
    talentos.push(bi(t.nome) + (efeito ? ': ' + efeito.replace(/\s+/g, ' ').slice(0, 300) : ''));
    if (m) habilidades.push({ nome: nomeHabilidade('Talento-' + t.nome), macro: m.macros[0].macro });
  }
  for (const t of P.talentos.filter((x) => !x.id)) talentos.push(t.nome);
  for (const [rotulo, v] of [['Classe', P.classe], ['Caminho Paragonal', P.paragon], ['Destino Épico', P.destino], ['Tema', P.tema], ['Antecedente', P.antecedente]]) if (v?.nome) classeFeats.push(`${rotulo}: ${bi(v.nome)}`);
  if (P.raca?.nome) racaFeats.push(`Raça: ${bi(P.raca.nome)}`);
  for (const it of P.itens || []) {
    inventario.push({ nome: bi(nomeItem(it)) + (it.equipado ? ' (equipado)' : ''), qtd: it.qtd ?? 1, valor: it.custo || 0 });
    if (!it.equipado) continue;
    const ref = it.ench?.id ? { cat: it.ench.cat, id: it.ench.id } : it.ref?.id ? it.ref : null;
    const m = ref && macroTexto(ref.cat, ref.id);
    if (m) for (const x of m.macros) habilidades.push({ nome: nomeHabilidade('Item-' + nomeItem(it) + '-' + x.rotulo), macro: x.macro });    const ma = it.augment?.id && macroTexto('weapon', it.augment.id); // poderes do augment (Death's Embrace, Life Drinking…) como habilidades
    if (ma) for (const x of ma.macros) habilidades.push({ nome: nomeHabilidade('Augment-' + it.augment.nome + '-' + x.rotulo), macro: x.macro });
  }

  // passivas de itens equipados: macro com o que foi somado e o que é situacional; resistências na ficha
  for (const ps of C.passivas || []) {
    habilidades.push({ nome: nomeHabilidade('Item-Passivas-' + ps.item), macro: r20.macroPassiva(ps) });
  }
  const resist = (C.passivas || []).flatMap((ps) => ps.resistencias.map((x) => `${x} (${ps.item})`));
  if (resist.length) A.resistances = resist.join('; ');

  // texto livre: traços, aparência, notas e o que o cálculo aplicou
  const aplicados = ['ac', 'fort', 'ref', 'vont', 'velocidade', 'iniciativa'].flatMap((k) => C.origem[k].filter((l) => l.aplicado && l.valor).map((l) => `${k.toUpperCase()} ${l.valor > 0 ? '+' : ''}${l.valor} (${l.fonte}${l.tipo ? ', ' + l.tipo : ''})`));
  const bio = [P.tracos && 'Traços: ' + P.tracos, P.aparencia && 'Aparência: ' + P.aparencia, P.companheiros && 'Companheiros: ' + P.companheiros,
    ...(P.notas || []).map((n) => `${n.titulo || n.nome || 'Nota'}: ${String(n.texto || n.conteudo || '').replace(/<[^>]+>/g, ' ').trim()}`),
    aplicados.length && 'Bônus aplicados pelo Grimório: ' + aplicados.join('; ')].filter(Boolean).join('\n\n');

  // duplicatas de nome de habilidade (o Roll20 não aceita)
  const vistos = new Set();
  const hab = habilidades.filter((h) => h.nome && !vistos.has(h.nome.toLowerCase()) && vistos.add(h.nome.toLowerCase()));
  const relevantes = avisos.filter((a) => !/mesma frase/.test(a));
  avisos.length = 0; avisos.push(...relevantes);
  if (C.avisos?.length) avisos.push(...C.avisos.slice(0, 5));
  return { formato: 'grimorio-roll20', versao: 1, nome: P.nome, atributos: A, poderes, habilidades: hab, talentos, classeFeats, racaFeats, inventario, bio, avisos };
}
