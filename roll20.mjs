// Gera a macro do Roll20 (template dnd4epower, mesmo formato do 4e Power Builder) a partir de um poder do compêndio.
// Os números (ataque, dano, crítico) vêm do texto em inglês; os textos exibidos vêm do português quando existir.
import * as comp from './compendio.mjs';

const ATRIBUTOS = ['Strength', 'Constitution', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma'];
const DEFESAS = { AC: 'AC', Fortitude: 'Fort', Reflex: 'Ref', Will: 'Will' };
const TIPOS_DANO = { acid: 'ácido', cold: 'gélido', fire: 'ígneo', force: 'energético', lightning: 'elétrico', necrotic: 'necrótico', poison: 'venenoso', psychic: 'psíquico', radiant: 'radiante', thunder: 'trovejante' };
const ROTULOS_PRINCIPAIS = { benefit: 'effect', target: 'target', targets: 'target', 'primary target': 'target', 'secondary target': 'secondarytarget', 'tertiary target': 'tertiarytarget', attack: 'attack', 'primary attack': 'attack', 'secondary attack': 'secondaryattack', 'tertiary attack': 'tertiaryattack', hit: 'hit', miss: 'miss', effect: 'effect', requirement: 'requirement', trigger: 'trigger', special: 'special', 'first failed saving throw': 'firstfailedsave', 'second failed saving throw': 'secondfailedsave', 'third failed saving throw': 'thirdfailedsave' };

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const texto = (h) => h.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m]).replace(/[ \t]+/g, ' ').trim();
// Segurança do template: nada que feche ou abra campos do Roll20.
const seguro = (s) => s.replace(/\}\}/g, '} }').replace(/\{\{/g, '{ {');

// Divide o HTML do poder em cabeçalho (tipo, palavras-chave, ação, alcance) e campos rotulados, na ordem.
export function analisar(html) {
  const r = { tipo: '', palavras: [], acao: '', alcance: '', campos: [], nivelTxt: '' };
  r.nivelTxt = texto((/<span class=level>([\s\S]*?)<\/span>/i.exec(html) || [, ''])[1]);
  let cab = false;
  for (const m of html.matchAll(/<p class=(\w+)>([\s\S]*?)<\/p>/g)) {
    const [, cls, corpo] = m;
    if (cls === 'publishedIn' || /^\s*<i>/.test(corpo)) continue;
    const linhas = corpo.split(/<br\s*\/?>/i);
    if (!cab && cls === 'powerstat') {
      cab = true;
      const [l0 = '', l1 = ''] = linhas;
      const [a, b = ''] = l0.split('✦');
      r.tipo = texto((/<b>([\s\S]*?)<\/b>/.exec(a) || [, ''])[1]);
      r.palavras = [...b.matchAll(/<b>([\s\S]*?)<\/b>/g)].map((x) => texto(x[1]));
      const ma = /<b>([\s\S]*?)<\/b>([\s\S]*)$/.exec(l1);
      if (ma) { r.acao = texto(ma[1]); r.alcance = texto(ma[2]); }
      continue;
    }
    // poder que concede outro poder (Form of Winter's Herald): as palavras-chave do poder concedido (Weapon, Implement...) ficam à parte
    if (cab && cls === 'powerstat' && linhas[0].includes('✦')) (r.palavrasExtra = r.palavrasExtra || []).push(...[...linhas[0].split('✦')[1].matchAll(/<b>([\s\S]*?)<\/b>/g)].map((x) => texto(x[1])));
    for (const l of linhas) {
      if (!l.trim()) continue;
      const lm = /^\s*<b>([^<]+)<\/b>\s*:\s*([\s\S]*)$/.exec(l);
      if (lm) r.campos.push({ rotulo: texto(lm[1]), texto: texto(lm[2]) });
      else if (r.campos.length) r.campos[r.campos.length - 1].texto += '\n' + texto(l);
    }
  }
  return r;
}

// "1d4 + Wisdom modifier radiant" -> {dados, lados|W, atributo, estatico, tipo}; null se não for um padrão simples.
export function lerDano(txt) {
  const i = txt.search(/\bdamage\b/i);
  if (i < 0) return null;
  const cabeca = txt.slice(0, i).trim();
  const termos = cabeca.split('+').map((t) => t.trim()).filter(Boolean);
  if (!termos.length) return null;
  let tipo = '';
  const ult = /^(.*?(?:modifier|\d|\]))\s*([a-z][a-z ,]*)?$/i.exec(termos[termos.length - 1]);
  if (!ult) return null;
  termos[termos.length - 1] = ult[1].trim(); tipo = (ult[2] || '').trim();
  const p = /^(\d+)(?:\[W\]|d(\d+))$/.exec(termos[0]);
  if (!p) return null;
  const d = { qtd: +p[1], lados: p[2] ? +p[2] : 0, arma: !p[2], atributo: '', estatico: [], tipo };
  for (const t of termos.slice(1)) {
    const am = /^(\w+) modifier$/i.exec(t);
    const ex = /^(\d+)\[W\](?:\s*\(([^)]*)\))?$/i.exec(t);
    if (ex && d.arma) (d.armasExtra = d.armasExtra || []).push({ qtd: +ex[1], off: /off-?hand/i.test(ex[2] || '') });
    else if (am && ATRIBUTOS.includes(am[1])) d.atributo = am[1];
    else if (/^\d+(d\d+)?$/.test(t)) d.estatico.push(t);
    else return null;
  }
  const resto = txt.slice(i).replace(/^damage/i, '').trim();
  d.resto = resto.replace(/^[.,;]\s*/, '');
  d.fraseUnica = !resto.replace(/^[.]$/, '');
  return d;
}

export function lerAtaque(txt) {
  const A = ATRIBUTOS.join('|');
  const m = new RegExp(`^(${A})(?:\\s*(?:,|or)\\s*(?:or\\s+)?(?:${A}))*\\s*(?:\\+\\s*(\\d+))?\\s+vs\\.?\\s*(AC|Fortitude|Reflex|Will)\\b`, 'i').exec(txt);
  if (!m) return null;
  const atributo = ATRIBUTOS.find((a) => a.toLowerCase() === m[1].toLowerCase());
  return { atributo, estatico: m[2] || '', defesa: DEFESAS[Object.keys(DEFESAS).find((k) => k.toLowerCase() === m[3].toLowerCase())] };
}

// Alcance em português a partir do original (a tradução por trechos às vezes duplica "rajada/explosão").
function alcancePT(en, traduzido) {
  const r = en
    .replace(/Area (burst|wall) (\d+) within (\d+)/i, (m, t, n, d) => `área: ${/wall/i.test(t) ? 'muralha' : 'explosão'} ${n} dentro de ${d} quadrados`)
    .replace(/Close burst/i, 'explosão contígua').replace(/Close blast/i, 'rajada contígua')
    .replace(/Ranged/i, 'à distância').replace(/Melee/i, 'corpo a corpo').replace(/Personal/i, 'pessoal')
    .replace(/\bweapon\b/i, 'arma').replace(/\btouch\b/i, 'toque').replace(/\bsight\b/i, 'visão')
    .replace(/(\d+)(?:st|nd|rd|th) level/gi, '$1º nível').replace(/\bat\b/gi, 'no').replace(/\s+squares?\b/gi, '');
  return /\b(Close|Area|Ranged|Melee|burst|blast|wall|within|level)\b/i.test(r) ? traduzido : r.toLowerCase();
}
const mod = (a) => `[[ @{${a.toLowerCase()}-mod} ]] [${a} modifier]`;
function tagAtaque(nome, a, fonte) {
  const partes = ['1d20', mod(a.atributo), '[[@{halflevel}]] [half level]'];
  if (fonte) partes.push(`[[ @{weapon-1-attack} ]] [${fonte} attack bonus]`);
  if (a.estatico) partes.push(`[[ ${a.estatico} ]] [static bonus]`);
  return `{{${nome}=[[ ${partes.join(' + ')} ]] vs **${a.defesa}**}}`;
}
function tagDano(prefixo, d, a, fonte, critico) {
  const p = [];
  if (d.arma) p.push(critico ? `(${d.qtd} * @{weapon-1-dice}) [maximum weapon damage]` : `${d.qtd}d@{weapon-1-dice}`);
  else p.push(critico ? `(${d.qtd} * ${d.lados}) [maximum power damage]` : `${d.qtd}d${d.lados}`);
  for (const x of d.armasExtra || []) {
    const w = x.off ? 'weapon-2-dice' : 'weapon-1-dice';
    p.push(critico ? `(${x.qtd} * @{${w}}) [maximum ${x.off ? 'off-hand ' : ''}weapon damage]` : `${x.qtd}d@{${w}}`);
  }
  if (d.atributo) p.push(mod(d.atributo));
  if (fonte) {
    p.push(`[[ @{weapon-1-damage} ]] [${fonte} damage bonus]`);
    if (critico) p.push('(@{weapon-1-enh}d@{weapon-1-per-plus}) [critical bonus damage]');
  }
  for (const e of d.estatico) p.push(`[[ ${e} ]] [static bonus]`);
  const tipo = d.tipo ? ` ${TIPOS_DANO[d.tipo.toLowerCase()] || d.tipo}` : '';
  return `{{${prefixo}${critico ? 'critical' : 'damage'}=[[ ${p.join(' + ')} ]] de dano${tipo}.}}`;
}

// ---------------------------------------------------------------- talentos e itens mágicos
const LVL = /^(level|nível|nivel)\s*\d+/i;
// Parágrafos de uma seção de item -> campos rotulados (<i>Trigger:</i>, <b>Attack:</b>...); sem rótulo = efeito.
function camposDeParagrafos(ps) {
  const campos = [];
  for (const p of ps) for (const l of p.split(/<br\s*\/?>/i)) {
    if (!texto(l)) continue;
    const lm = /^\s*<(?:i|b)>\s*([^<]*?)\s*:?\s*<\/(?:i|b)>\s*:?\s*([\s\S]*)$/.exec(l);
    if (lm && lm[1] && !LVL.test(lm[1])) campos.push({ rotulo: texto(lm[1]), texto: texto(lm[2]) });
    else if (campos.length) campos[campos.length - 1].texto += '\n' + texto(l);
    else campos.push({ rotulo: 'Effect', texto: texto(l) });
  }
  return campos;
}
function analisarItem(html) {
  const r = { cab: [], secoes: [], nivelTxt: texto((/<span class=milevel[^>]*>([\s\S]*?)<\/span>/i.exec(html) || [, ''])[1]) };
  let atual = null;
  for (const m of html.matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>|<p class=['"]?(mistat[^'">]*)['"]?>([\s\S]*?)<\/p>/g)) {
    if (m[2] !== undefined) {
      if (/ah1/.test(m[1])) break;
      atual = { titulo: texto(m[2]), ps: [] }; r.secoes.push(atual);
    } else if (atual) atual.ps.push(m[4]);
    else if (/<b>/.test(m[4])) r.cab.push(texto(m[4]));
  }
  r.secoes.forEach((s) => { s.campos = camposDeParagrafos(s.ps); s.tipo = /\b(Power|Poder)\b/i.test(s.titulo) && /✦/.test(s.titulo) ? 'poder' : /^Propert|^Propriedade/i.test(s.titulo) ? 'prop' : ''; });
  return r;
}
// "Power (Fire) ✦ Daily (Minor Action)" -> { freq, acao, palavras }
function lerTituloPoder(t) {
  const [esq, dir] = t.split('✦');
  if (dir === undefined) return { palavras: [], freq: '', acao: '' };
  const kw = /\(([^)]*)\)/.exec(esq);
  const m = /^\s*([^(]+?)\s*(?:\(([^)]*)\))?\s*$/.exec(dir) || [];
  return { palavras: kw ? kw[1].split(/,\s*|\s+or\s+|\s+ou\s+/).filter(Boolean) : [], freq: (m[1] || '').trim(), acao: (m[2] || '').trim() };
}
const mesmaForma = (a, b) => a.length === b.length && a.every((s, i) => s.campos.length === b[i].campos.length);

function macrosItem(cat, det, lang, avisos) {
  const en = analisarItem(det.html);
  let pt = lang === 'pt' && det.htmlPT ? analisarItem(det.htmlPT) : null;
  if (pt && !mesmaForma(en.secoes, pt.secoes)) { pt = null; avisos.push('A tradução tem estrutura diferente do original; usei o texto em inglês.'); }
  const T = pt || en;
  const nome = det.meta.Name;
  const nivel = (/(\d+)/.exec(en.nivelTxt) || [])[1] || '';
  const classe = ({ weapon: 'arma mágica', armor: 'armadura mágica', implement: 'implemento mágico' }[cat] || 'item mágico');
  const base = { nome, classe, avisos, nivelTag: nivel, alcance: '', alcanceEN: '' };
  const saidas = [];
  // passivas: Property/Properties + linhas de aprimoramento, crítico, slot
  const props = en.secoes.map((s, i) => ({ s, t: T.secoes[i] })).filter((x) => x.s.tipo === 'prop');
  const textoProps = props.flatMap((x) => x.t.campos.map((c) => c.texto)).join('\n');
  const cab = T.cab.join('\n');
  if (textoProps || cab) {
    saidas.push({
      rotulo: pt ? 'Propriedades' : 'Properties',
      ...montar({ ...base, grupo: 'other', tipoTxt: pt ? 'propriedade' : 'property', kwTxt: '', acao: '', fonte: '',
        campos: [{ rotulo: 'Effect', texto: '' }, { rotulo: 'Special', texto: '' }],
        camposT: [{ rotulo: 'Effect', texto: textoProps || cab }, { rotulo: 'Special', texto: textoProps ? cab : '' }] }),
    });
  }
  en.secoes.forEach((s, i) => {
    if (s.tipo !== 'poder') return;
    const lt = lerTituloPoder(T.secoes[i].titulo), le = lerTituloPoder(s.titulo);
    saidas.push({
      rotulo: T.secoes[i].titulo.replace(/^[^\p{L}]+/u, ''),
      ...montar({ ...base, grupo: 'item', tipoTxt: (lt.freq || le.freq).toLowerCase(), kwTxt: (lt.palavras.length ? lt.palavras : le.palavras).join(', ').toLowerCase(),
        acao: (lt.acao || le.acao).toLowerCase(), fonte: '', campos: s.campos, camposT: T.secoes[i].campos }),
    });
  });
  return saidas;
}

function macroTalento(det, lang, avisos) {
  const en = analisar(det.html);
  let pt = lang === 'pt' && det.htmlPT ? analisar(det.htmlPT) : null;
  if (pt && pt.campos.length !== en.campos.length) pt = null;
  const T = pt || en;
  const req = (cs) => cs.map((c) => (/^prerequisite$/i.test(c.rotulo) ? { ...c, rotulo: 'Requirement' } : c));
  let campos = req(en.campos), camposT = T.campos;
  if (!campos.length) {
    const corpo = texto((/<\/h1>([\s\S]*?)(?:<p class=publishedIn|$)/.exec(pt ? det.htmlPT : det.html) || [, ''])[1].replace(/<br\s*\/?>/gi, '\n'));
    if (!corpo) return [];
    campos = [{ rotulo: 'Effect', texto: '' }]; camposT = [{ rotulo: 'Effect', texto: corpo }];
  }
  return [{ rotulo: pt ? 'Talento' : 'Feat', ...montar({ grupo: 'other', nome: det.meta.Name, classe: pt ? 'talento' : 'feat', avisos, nivelTag: '', tipoTxt: pt ? 'talento' : 'feat', kwTxt: '', acao: '', alcance: '', alcanceEN: '', fonte: '', campos, camposT }) }];
}

const ITENS = ['item', 'weapon', 'armor', 'implement'];
// Devolve { macros: [{ rotulo, macro }], avisos } ou null se a entrada não tem o que virar macro.
export function gerarMacros(cat, id, lang = 'pt') {
  const det = comp.detalhe(cat, id);
  if (!det) return null;
  if (cat === 'power') { const m = gerarMacro(cat, id, lang); return m && { macros: [{ rotulo: det.meta.Name, macro: m.macro }], avisos: m.avisos }; }
  const avisos = [];
  let saidas = [];
  if (cat === 'feat') saidas = macroTalento(det, lang, avisos);
  else if (ITENS.includes(cat) && /class=mihead/.test(det.html)) saidas = macrosItem(cat, det, lang, avisos);
  return saidas.length ? { macros: saidas.map((s) => ({ rotulo: s.rotulo, macro: s.macro })), avisos } : null;
}
export const suporta = (cat, id) => !!gerarMacros(cat, id, 'en');

export function gerarMacro(cat, id, lang = 'pt') {
  const det = comp.detalhe(cat, id);
  if (!det || cat !== 'power') return null;
  const avisos = [];
  const en = analisar(det.html);
  let pt = lang === 'pt' && det.htmlPT ? analisar(det.htmlPT) : null;
  if (pt && pt.campos.length !== en.campos.length) { pt = null; avisos.push('A tradução tem estrutura diferente do original; usei o texto em inglês.'); }
  const T = pt || en; // texto exibido
  const nome = det.meta.Name;
  const nivelM = /(Attack|Utility)\s*(\d+)?/i.exec(en.nivelTxt) || [];
  const util = /utility/i.test(nivelM[1] || det.meta.Type || '');
  const grupo = /at-?will/i.test(en.tipo) ? 'atwill' : /daily/i.test(en.tipo) ? 'daily' : /encounter/i.test(en.tipo) ? 'encounter' : 'other';
  const classe = (comp.nomePT(det.meta.ClassName) || det.meta.ClassName || '').toLowerCase();
  const kw = en.palavras.join(' ').toLowerCase();
  const fonte = /\bimplement\b/.test(kw) ? 'implement' : /\bweapon\b/.test(kw) ? 'weapon' : '';

  return montar({
    grupo, nome, classe, avisos, fonte,
    nivelTag: util ? `utility${nivelM[2] ? ' ' + nivelM[2] : ''}` : nivelM[2],
    tipoTxt: T.tipo.toLowerCase(), kwTxt: T.palavras.map((x) => x.toLowerCase()).join(', '),
    acao: T.acao.toLowerCase(),
    alcance: pt ? alcancePT(en.alcance, T.alcance.toLowerCase()) : en.alcance.toLowerCase(),
    alcanceEN: en.alcance, campos: en.campos, camposT: T.campos,
  });
}

// Monta o texto da macro a partir de campos já classificados (usado por poderes, talentos e itens).
function montar(S) {
  const { grupo, nome, classe, avisos, fonte, nivelTag, tipoTxt, kwTxt, acao, alcance, alcanceEN } = S;
  const camposEN = S.campos, camposT = S.camposT;
  const tags = [];
  const tag = (k, v) => { if (v) tags.push(`{{${k}=${seguro(v)}}}`); };
  tags.push('&{template:dnd4epower}', `{{${grupo}=1}}`);
  tag('name', nome); tag('class', classe);
  tag('level', nivelTag);
  if (tipoTxt) tags.push(`{{type=${seguro(tipoTxt)}${kwTxt ? ' ♦ ' : ''}}}`);
  tag('keywords', kwTxt);
  if (acao) tags.push(`{{action=${seguro(acao)}${alcance ? ' ♦ ' : ''}}}`);
  tag('range', alcance);

  // campos na ordem; atual = conjunto (primário/secundário/terciário) ao qual Hit/Miss pertencem
  const temSecundario = camposEN.some((c) => /^secondary attack$/i.test(c.rotulo));
  const area = /(burst|blast|wall)/i.test(alcanceEN || '');
  let atual = '';
  let atqPrincipal = null;
  const customs = [];
  camposEN.forEach((c, i) => {
    const chave = ROTULOS_PRINCIPAIS[c.rotulo.toLowerCase()];
    const txtOut = (camposT[i] || c).texto;
    const lb = c.rotulo.toLowerCase();
    if (chave === 'target') {
      if (lb === 'primary target' || (temSecundario && lb === 'target')) tag('primarytarget', txtOut); else tag('target', txtOut);
      atual = ''; return;
    }
    if (chave === 'secondarytarget' || chave === 'tertiarytarget') { tag(chave, txtOut); return; }
    if (chave === 'attack' || chave === 'secondaryattack' || chave === 'tertiaryattack') {
      const pref = chave === 'attack' ? '' : chave.replace('attack', '');
      atual = pref;
      const a = lerAtaque(c.texto);
      if (!a) { tag(chave, txtOut); avisos.push(`Ataque "${c.texto}" fora do padrão; copiado como texto.`); return; }
      tags.push(tagAtaque(`${pref}attack`, a, fonte));
      if (!pref) {
        atqPrincipal = a;
        if (area && /\b(each|every|all)\b/i.test(camposEN.find((x) => /target/i.test(x.rotulo))?.texto || '')) {
          tags.push('{{multiattacktoggle=[[?{Number of Attacks|2}]]}}');
          for (let n = 2; n <= 9; n++) tags.push(tagAtaque(`multiattack${n}`, a, fonte));
        }
      }
      return;
    }
    if (chave === 'hit') {
      const d = atqPrincipal || atual ? lerDano(c.texto) : null;
      const a = atual === '' ? atqPrincipal : null;
      if (d) {
        const ref = a || { atributo: d.atributo || 'Strength' };
        tags.push(tagDano(atual, d, ref, d.arma || fonte ? (fonte || 'weapon') : '', false));
        tags.push(tagDano(atual, d, ref, d.arma || fonte ? (fonte || 'weapon') : '', true));
        if (!d.fraseUnica) {
          // restante do texto (condição aplicada no acerto): parte da tradução depois da primeira frase, ou tudo se não der para separar
          let sobra = txtOut;
          const corte = /\.\s+(?=\S)/.exec(txtOut);
          const virgula = /^[^,.]*?\bdano\b[^,.]*,\s*(?:e\s+)?/i.exec(txtOut);
          if (/^[,;]/.test(d.resto) && virgula) sobra = txtOut.slice(virgula[0].length).trim();
          else if (corte && /\.\s+\S/.test(c.texto)) sobra = txtOut.slice(corte.index + 1).trim();
          else if (!/\.\s+\S/.test(c.texto)) avisos.push('O acerto tem dano e efeito na mesma frase; o texto completo foi para "hiteffect".');
          tag(`${atual}hiteffect`, sobra);
        }
      } else tag(`${atual}hiteffect`, txtOut);
      return;
    }
    if (chave === 'miss') { atual === '' ? tag('miss', txtOut) : customs.push(['**Miss:**', txtOut]); return; }
    if (chave) { customs.push([chave, txtOut, true]); return; }
    if (/^prerequisite$/i.test(c.rotulo)) return;
    customs.push([`**${camposT[i]?.rotulo || c.rotulo}:**`, txtOut]);
  });
  // ordem do Power Builder: effect, falhas de salvamento, special e por fim os rótulos livres
  const por = (k) => customs.filter((x) => x[0] === k).forEach((x) => tag(x[0], x[1]));
  ['requirement', 'trigger', 'effect', 'firstfailedsave', 'secondfailedsave', 'thirdfailedsave', 'special'].forEach(por);
  customs.filter((x) => !x[2]).forEach((x) => tag(x[0], x[1]));
  // requirement/trigger devem vir antes do alvo no template; reordena de forma estável
  const ordem = ['&{template', '{{atwill', '{{encounter', '{{daily', '{{other', '{{item', '{{name', '{{class', '{{level', '{{type', '{{keywords', '{{action', '{{range', '{{requirement', '{{trigger'];
  const pri = tags.filter((t) => ordem.some((o) => t.startsWith(o)));
  pri.sort((a, b) => ordem.findIndex((o) => a.startsWith(o)) - ordem.findIndex((o) => b.startsWith(o)));
  const resto = tags.filter((t) => !pri.includes(t));
  return { macro: [...pri, ...resto].join(' '), avisos };
}

// ---------------------------------------------------------------- dados do poder para os campos da ficha do Roll20
const ACOES_FICHA = [[/interrupt/i, 'Immediate Interrupt'], [/reaction/i, 'Immediate Reaction'], [/opportunity/i, 'Opportunity Action'], [/immediate/i, 'Immediate'], [/no action/i, 'No Action'], [/free/i, 'Free Action'], [/minor/i, 'Minor'], [/move/i, 'Move'], [/standard/i, 'Standard']];
export function resumoPoder(id, lang = 'pt') {
  const det = comp.detalhe('power', id);
  if (!det) return null;
  const en = analisar(det.html);
  const pt = lang === 'pt' && det.htmlPT ? analisar(det.htmlPT) : null;
  const uso = /at-?will/i.test(en.tipo) ? 'At-Will' : /daily/i.test(en.tipo) ? 'Daily' : /encounter/i.test(en.tipo) ? 'Encounter' : 'Item';
  const acao = (ACOES_FICHA.find(([re]) => re.test(en.acao)) || [, 'Standard'])[1];
  const alcance = pt ? alcancePT(en.alcance, (pt.alcance || '').toLowerCase()) : en.alcance.toLowerCase();
  const nivel = (/(\d+)\s*$/.exec(en.nivelTxt) || [])[1] || '';
  return { uso, acao, alcance, nivel };
}
// Macro "Passivas" de um item equipado: o que o Grimório já somou na ficha e o que só vale em certas situações.
const STAT_PT = { 'Armor Class': 'CA', 'Fortitude Defense': 'Fortitude', 'Reflex Defense': 'Reflexos', 'Will Defense': 'Vontade', 'Attack Rolls': 'jogadas de ataque', 'Damage Rolls': 'jogadas de dano', Speed: 'deslocamento', Initiative: 'iniciativa' };
export function macroPassiva({ item, aplicadas = [], situacionais = [], resistencias = [], jaNasRegras = false }) {
  const nomeStat = (s) => STAT_PT[s] || s.replace(/ Misc$/, '');
  const linhas = [];
  if (aplicadas.length) linhas.push('Somado automaticamente na ficha: ' + aplicadas.map((x) => `+${x.valor}${x.tipo ? ' (' + x.tipo + ')' : ''} em ${nomeStat(x.stat)}`).join('; ') + '.');
  else if (jaNasRegras) linhas.push('Os bônus fixos deste item já estão somados na ficha.');
  if (resistencias.length) linhas.push('Resistências: ' + resistencias.join('; ') + '.');
  return montar({
    grupo: 'other', nome: item, classe: 'passiva', avisos: [], nivelTag: '', tipoTxt: 'passiva', kwTxt: '', acao: '', alcance: '', alcanceEN: '', fonte: '',
    campos: [{ rotulo: 'Effect', texto: '' }, { rotulo: 'Special', texto: '' }],
    camposT: [{ rotulo: 'Effect', texto: linhas.join('\n') || 'Sem bônus automático.' }, { rotulo: 'Special', texto: situacionais.length ? 'Situacional (valem só quando a condição acontecer): ' + situacionais.join('; ') + '.' : '' }],
  }).macro;
}