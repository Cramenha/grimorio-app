// Criaturas, monstros e chefes de D&D 4e: modelo, leitura dos monstros do compêndio (iws.mx), calculadora automática
// (valores medidos no próprio compêndio), bloco de estatísticas e macros do Roll20 (template dnd4epower).
import fs from 'node:fs';
import path from 'node:path';
import { COMPENDIO } from './caminhos.mjs';
import * as comp from './compendio.mjs';
import { novoId } from './importar.mjs';
import { trechos } from './segmentos.mjs';

export const FUNCOES = ['Artillery', 'Brute', 'Controller', 'Lurker', 'Skirmisher', 'Soldier'];
export const GRUPOS = ['Standard', 'Elite', 'Solo', 'Minion'];
export const TAMANHOS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
export const ATRIBUTOS = ['for', 'con', 'des', 'int', 'sab', 'car'];
export const FUNCAO_PT = { Artillery: 'Artilheiro', Brute: 'Bruto', Controller: 'Controlador', Lurker: 'Espreitador', Skirmisher: 'Escaramuçador', Soldier: 'Soldado', None: 'Sem função' };
const PLURAL_CAT = { rasgo: 'Características', padrao: 'Ações padrão', movimento: 'Ações de movimento', menor: 'Ações menores', gatilho: 'Reações e interrupções', livre: 'Ações livres' };
export const GRUPO_PT = { Standard: 'Padrão', Elite: 'Elite', Solo: 'Solo', Minion: 'Lacaio' };
export const TAMANHO_PT = { Tiny: 'Miúdo', Small: 'Pequeno', Medium: 'Médio', Large: 'Grande', Huge: 'Enorme', Gargantuan: 'Imenso' };
export const CATEGORIAS = ['rasgo', 'padrao', 'movimento', 'menor', 'gatilho', 'livre'];
export const CATEGORIA_PT = { rasgo: 'Característica', padrao: 'Ação padrão', movimento: 'Ação de movimento', menor: 'Ação menor', gatilho: 'Ação desencadeada', livre: 'Ação livre' };
export const USOS = ['at-will', 'encounter', 'daily', 'recharge', 'aura', ''];
export const USO_PT = { 'at-will': 'sem limite', encounter: 'encontro', daily: 'diário', recharge: 'recarga', aura: 'aura', '': '' };
const DEF_CURTA = { ac: 'AC', fort: 'Fort', ref: 'Ref', will: 'Will' };
const ATR_FICHA = { for: 'strength', con: 'constitution', des: 'dexterity', int: 'intelligence', sab: 'wisdom', car: 'charisma' };
const ATR_EN = { str: 'for', con: 'con', dex: 'des', int: 'int', wis: 'sab', cha: 'car' };
const PERICIAS = ['Acrobatics', 'Arcana', 'Athletics', 'Bluff', 'Diplomacy', 'Dungeoneering', 'Endurance', 'Heal', 'History', 'Insight', 'Intimidate', 'Nature', 'Perception', 'Religion', 'Stealth', 'Streetwise', 'Thievery'];

const txt = (h) => String(h ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
const seguro = (s) => String(s ?? '').replace(/\}\}/g, '} }').replace(/\{\{/g, '{ {');
const mod = (n) => Math.floor((n - 10) / 2);

// ------------------------------------------------------------------ modelo
export function novoPoder(base = {}) {
  return { id: novoId(), nome: 'Novo poder', categoria: 'padrao', uso: 'at-will', recarga: '', simbolo: '', palavras: '', gatilho: '', requisito: '', alcance: '', alvo: '',
    ataque: null, dano: '', acerto: '', erro: '', efeito: '', especial: '', extras: [], ...base };
}
export function novaCriatura(base = {}) {
  const agora = new Date().toISOString();
  return {
    id: novoId(), tipo: 'criatura', versao: 1, criado: agora, atualizado: agora,
    nome: 'Nova criatura', nivel: 1, funcao: 'Soldier', lider: false, grupo: 'Standard', tamanho: 'Medium', tipoTexto: 'natural humanoid',
    xpManual: null, tendencia: 'Unaligned', idiomas: '', pericias: '', equipamento: '',
    atr: { for: 12, con: 12, des: 12, int: 10, sab: 10, car: 10 },
    pv: 0, iniciativa: 0, ca: 0, fort: 0, ref: 0, vont: 0, velocidade: '6', sentidos: 'Perception +0', resistencias: '', vulnerabilidades: '', imunidades: '',
    testesSalvamento: '', pontosAcao: '', poderes: [], descricao: '', taticas: '',
    notas: [], historico: [{ quando: agora, tipo: 'criacao', texto: 'Criatura criada.' }], retrato: null,
    ...base,
  };
}

// ------------------------------------------------------------------ tabelas (Estatísticas dos Monstros por Função, Dano por Nível: D:RGP DO HANSestatísticas.png e dano por nivel.png)
const BASE_FUNCAO = { // CA somada ao nível; bônus de iniciativa (somado à metade do nível + mod. de Destreza); PV = hp*(nível+1) + Con
  Soldier: { ac: 16, ini: 2, hp: 8 }, Skirmisher: { ac: 14, ini: 2, hp: 8 },
  Brute: { ac: 12, ini: 0, hp: 10 }, Artillery: { ac: 12, ini: 0, hp: 6 },
  Controller: { ac: 14, ini: 0, hp: 8 }, Lurker: { ac: 14, ini: 4, hp: 6 },
};
const OUTRAS_DEFESAS = 12; // Fort, Ref e Vont = nível + 12 em qualquer função
// elite = 2x o PV padrão; solitário = 4x até o nível 10 e 5x acima; lacaio = 1 PV
const multPV = (grupo, n) => ({ Standard: 1, Elite: 2, Solo: n <= 10 ? 4 : 5, Minion: 0 })[grupo || 'Standard'];
// dano por nível [um alvo, dois ou mais alvos], nível 1 a 30
const DANO_NIVEL = [
  ['1d8+4', '1d6+3'], ['1d8+5', '1d6+4'], ['1d8+6', '1d6+5'], ['2d6+5', '1d8+5'], ['2d6+6', '1d8+6'], ['2d6+7', '1d8+6'], ['2d8+6', '2d6+4'], ['2d8+7', '2d6+5'], ['2d8+8', '2d6+6'], ['2d8+9', '2d6+6'],
  ['3d6+9', '2d6+7'], ['3d6+10', '2d8+6'], ['3d6+11', '2d8+7'], ['3d6+12', '2d8+7'], ['3d6+13', '2d8+8'], ['3d8+11', '3d6+8'], ['3d8+12', '3d6+9'], ['3d8+13', '3d6+9'], ['3d8+14', '3d6+10'], ['3d8+15', '3d6+11'],
  ['4d6+15', '3d8+9'], ['4d6+16', '3d8+9'], ['4d6+17', '3d8+10'], ['4d6+18', '3d8+11'], ['4d6+19', '3d8+12'], ['4d8+16', '4d6+11'], ['4d8+17', '4d6+12'], ['4d8+18', '4d6+13'], ['4d8+19', '4d6+14'], ['4d8+20', '4d6+15'],
];
const MULT_DANO_USO = { 'at-will': 1, aura: 1, '': 1, encounter: 1.25, recharge: 1.25, daily: 1.5 }; // limitados: +25% (encontro, recarga) ou +50% (diário)
const MULT_DANO_BRUTO = 1.25;
const XP_PADRAO = [0, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500, 600, 700, 800, 1000, 1200, 1400, 1600, 2000, 2400, 2800, 3200, 4150, 5100, 6050, 7000, 9000, 11000, 13000, 15000, 19000, 23000, 27000, 31000, 35000, 39000, 43000];

export function xpDe(nivel, grupo) {
  const n = Math.max(0, Math.min(36, nivel | 0));
  const base = n === 0 ? 25 : XP_PADRAO[n];
  return Math.round(({ Standard: 1, Elite: 2, Solo: 5, Minion: 0.25 })[grupo] * base) || base;
}

export function sugerir(c) {
  const f = BASE_FUNCAO[c.funcao] || BASE_FUNCAO.Soldier;
  const n = +c.nivel || 1, con = +c.atr?.con || 12, des = +c.atr?.des || 10;
  const pvPadrao = f.hp * (n + 1) + con;
  return {
    ca: n + f.ac, fort: n + OUTRAS_DEFESAS, ref: n + OUTRAS_DEFESAS, vont: n + OUTRAS_DEFESAS, iniciativa: Math.floor(n / 2) + mod(des) + f.ini,
    pv: c.grupo === 'Minion' ? 1 : Math.round(pvPadrao * multPV(c.grupo, n)),
    ataqueCA: n + 5, ataqueNAD: n + 3, xp: xpDe(n, c.grupo),
    testesResist: ({ Elite: 2, Solo: 5 })[c.grupo] || 0, pontosAcao: ({ Elite: 1, Solo: 2 })[c.grupo] || 0, // elite +2 TR e 1 PA; solitário +5 TR e 2 PA
  };
}
export function atributosSugeridos(c) {
  const n = +c.nivel || 1, alto = 14 + Math.floor(n / 2), medio = 12 + Math.floor(n / 3), baixo = 9 + Math.floor(n / 4);
  const alvo = { Soldier: ['for', 'con'], Brute: ['for', 'con'], Artillery: ['des', 'sab'], Controller: ['int', 'sab'], Lurker: ['des', 'car'], Skirmisher: ['des', 'for'] }[c.funcao] || ['for', 'con'];
  const r = {};
  for (const k of ATRIBUTOS) r[k] = alvo[0] === k ? alto + 1 : alvo[1] === k ? alto - 1 : k === 'con' ? medio : (k === 'int' || k === 'car' ? baixo : medio - 1);
  return r;
}
// expressão de dano com a média pedida (dados + bônus fixo)
export function expressaoDano(media, lados = 8) {
  const m = Math.max(1, media);
  const dado = (lados + 1) / 2;
  const n = Math.max(1, Math.round((m * 0.6) / dado));
  const fixo = Math.round(m - n * dado);
  return `${n}d${lados}${fixo > 0 ? ' + ' + fixo : fixo < 0 ? ' - ' + (-fixo) : ''}`;
}
const ehArea = (p) => /burst|blast|area|wall/i.test(p.alcance || '');
const ehVariosAlvos = (p) => ehArea(p) || /\b(each|all|every|two|three|four|up to|creatures|enemies)\b/i.test(p.alvo || '');
export function danoSugerido(c, p) {
  const n = Math.max(1, Math.min(30, +c.nivel || 1));
  if (c.grupo === 'Minion') return String(4 + Math.ceil(n / 4)); // dano fixo do lacaio (Sly Flourish)
  const base = DANO_NIVEL[n - 1][ehVariosAlvos(p) ? 1 : 0];
  const mult = (MULT_DANO_USO[p.uso || ''] ?? 1) * (c.funcao === 'Brute' ? MULT_DANO_BRUTO : 1);
  if (mult === 1) return base;
  const [, dados, lados, fixo] = /^(\d+)d(\d+)\+(\d+)$/.exec(base);
  return expressaoDano((+dados * (+lados + 1) / 2 + +fixo) * mult, +lados);
}
// bônus de ataque: nível + 5 (CA) ou nível + 3 (outras defesas); +1 à distância e +2 em área (a tabela manda aumentar 1 ou 2)
export function ataqueSugerido(c, defesa = 'AC', p = {}) {
  const n = +c.nivel || 1;
  const extra = ehArea(p) ? 2 : /ranged/i.test(p.alcance || '') ? 1 : 0;
  return { bonus: n + (defesa === 'AC' ? 5 : 3) + extra, defesa };
}

// ------------------------------------------------------------------ valores derivados
export function derivar(c) {
  const meio = Math.floor((+c.nivel || 0) / 2);
  const mods = {}, bonus = {};
  for (const k of ATRIBUTOS) { mods[k] = mod(+c.atr?.[k] || 10); bonus[k] = mods[k] + meio; }
  return { meio, mods, bonus, sangrando: Math.floor((+c.pv || 0) / 2), xp: c.xpManual ?? xpDe(+c.nivel, c.grupo), sugestao: sugerir(c) };
}

// ------------------------------------------------------------------ dano: leitura e conta
export function extrairDano(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ');
  const termos = [];
  for (const m of t.matchAll(/(\d+d\d+(?:\s*[+-]\s*\d+)?|\b\d+\b)(?=\s+(?:de\s+)?(?:[a-z]+(?:, [a-z]+)*\s+)?(?:damage|dano))/gi)) {
    if (/ongoing\s*$/i.test(t.slice(Math.max(0, m.index - 10), m.index))) continue;
    if (/\bMiss:/.test(t.slice(0, m.index))) break;
    termos.push(m[1].replace(/\s+/g, ''));
    if (termos.length >= 2) break;
  }
  return termos.map((x) => x.replace(/([+-])/g, ' $1 ').replace(/\s+/g, ' ').trim()).join(' + ');
}
export function danoMaximo(expr) {
  return String(expr || '').replace(/(\d+)d(\d+)/g, (m, n, d) => String(+n * +d));
}

// ------------------------------------------------------------------ leitura de um monstro do compêndio
const ACOES = [[/immediate\s+interrupt/i, 'immediate interrupt'], [/immediate\s+reaction/i, 'immediate reaction'], [/opportunity/i, 'opportunity'], [/no action/i, 'no action'], [/free/i, 'free'], [/minor/i, 'minor'], [/move/i, 'move'], [/standard/i, 'standard']];
const SECAO_CAT = { traits: 'rasgo', 'standard actions': 'padrao', 'move actions': 'movimento', 'minor actions': 'menor', 'triggered actions': 'gatilho', 'free actions': 'livre' };
const ACAO_CAT = { standard: 'padrao', move: 'movimento', minor: 'menor', free: 'livre', 'immediate interrupt': 'gatilho', 'immediate reaction': 'gatilho', opportunity: 'gatilho', 'no action': 'gatilho' };

function recargaDe(s) { // "⚃ ⚄ ⚅" -> "4", "⚅" -> "6"
  const faces = [...String(s)].map((ch) => '⚀⚁⚂⚃⚄⚅'.indexOf(ch) + 1).filter((x) => x > 0);
  return faces.length ? String(Math.min(...faces)) : '';
}
function lerAtaque(t) {
  // "Melee 1 (one creature); +6 vs. AC"  /  "Close burst 3 (creatures in the burst); +4 vs. Reflex"
  const m = /^([^;(]*?)\s*(?:\(([^)]*)\))?\s*;?\s*\+(\d+)\s+vs\.?\s*(AC|Fortitude|Fort|Reflex|Ref|Will)\b\s*(.*)$/is.exec(t.trim());
  if (!m) return null;
  const def = { fortitude: 'Fort', fort: 'Fort', reflex: 'Ref', ref: 'Ref', will: 'Will', ac: 'AC' }[m[4].toLowerCase()];
  return { alcance: m[1].trim(), alvo: (m[2] || '').trim(), bonus: +m[3], defesa: def, resto: m[5].trim() };
}
const ALCANCE_RE = /^(Reach \d+|Melee(?: touch|\s+\d+)?|Ranged(?:\s+\d+(?:\/\d+)?)?|Close (?:burst|blast) \d+|Area (?:burst|wall) \d+ within \d+|Melee or Ranged \d+)\b/i;

function cabecalho(h, formatoNovo, secao) {
  const p = { ...novoPoder({ ataque: null }), categoria: SECAO_CAT[String(secao || '').toLowerCase()] || (formatoNovo ? 'padrao' : 'rasgo'), uso: '' };
  const simb = /^\s*([^<\w]*?)\s*<b>/.exec(h);
  p.simbolo = simb ? txt(simb[1]).replace(/[()]/g, '').trim() : '';
  const nm = /<b>([\s\S]*?)<\/b>/.exec(h);
  p.nome = txt(nm ? nm[1] : h);
  const resto = h.slice(nm ? nm.index + nm[0].length : 0);
  const [esq, dir = ''] = resto.split('✦');
  const par = /\(([\s\S]*?)\)/.exec(esq);
  const dirTxt = txt(dir);
  const dirBolds = [...dir.matchAll(/<b>([\s\S]*?)<\/b>/g)].map((x) => txt(x[1]));
  const usoEm = (s) => (/aura/i.test(s) ? 'aura' : /recharge/i.test(s) ? 'recharge' : /encounter/i.test(s) ? 'encounter' : /daily/i.test(s) ? 'daily' : /at-will/i.test(s) ? 'at-will' : '');
  if (formatoNovo) {
    p.uso = usoEm(dirTxt);
    if (p.uso === 'recharge') p.recarga = recargaDe(dirTxt) || (/bloodied/i.test(dirTxt) ? 'sangrando' : '');
    if (p.uso === 'aura') p.alcance = (/aura\s*(\d+)/i.exec(dirTxt) || [])[1] || '';
    if (/\/round/i.test(dirTxt)) p.especial = (/at-will\s*(\d+\/round)/i.exec(dirTxt) || [])[1] ? `${(/at-will\s*(\d+\/round)/i.exec(dirTxt))[1]}` : '';
    const kws = [...(par ? par[1].split(/,\s*/) : []), ...dirBolds.filter((b) => !usoEm(b))].map((k) => k.trim()).filter(Boolean);
    p.palavras = kws.join(', ');
  } else {
    const partes = par ? par[1].split(/,(?![^()]*\))/).map((s) => s.trim()) : [];
    if (partes.length) {
      const acao = ACOES.find(([re]) => re.test(partes[0]));
      if (acao) {
        p.categoria = ACAO_CAT[acao[1]]; p.acao = acao[1];
        const ultimo = partes[partes.length - 1];
        p.uso = usoEm(ultimo) || '';
        if (p.uso === 'recharge') p.recarga = recargaDe(ultimo) || (/bloodied/i.test(ultimo) ? 'sangrando' : '');
        const meio = partes.slice(1, usoEm(ultimo) ? -1 : undefined).filter(Boolean);
        if (meio.length) p.gatilho = meio.join(', ');
        if (/\/round/i.test(partes[0])) p.especial = (/(\d+\/round)/i.exec(partes[0]) || [])[1] || '';
      } else p.categoria = 'rasgo';
    } else p.categoria = 'rasgo';
    p.palavras = dirBolds.join(', ');
    if (!p.uso && dirTxt) p.uso = usoEm(dirTxt);
  }
  if (p.uso === 'aura') p.categoria = 'rasgo';
  if (!p.uso && p.categoria === 'rasgo') p.uso = '';
  return p;
}

function corpoNovo(p, paragrafos) {
  let secundario = false;
  for (const h of paragrafos) {
    const m = /^\s*<i>([^<]*?)\s*:?\s*<\/i>\s*:?\s*([\s\S]*)$/.exec(h);
    if (!m) { p.efeito = [p.efeito, txt(h)].filter(Boolean).join('\n'); continue; }
    const rotulo = txt(m[1]).replace(/:$/, ''), t = txt(m[2]);
    const acaoRot = /\(([^)]+)\)/.exec(rotulo);
    if (acaoRot) { const a = ACOES.find(([re]) => re.test(acaoRot[1])); if (a) { p.acao = a[1]; if (p.categoria === 'gatilho' || p.categoria === 'rasgo') p.categoria = ACAO_CAT[a[1]] || p.categoria; } }
    const base = rotulo.replace(/\s*\(.*\)$/, '').toLowerCase();
    if (secundario && /^(hit|miss|effect)$/.test(base)) { p.extras.push({ rotulo: `${rotulo} (secundário)`, texto: t }); continue; }
    if (base === 'attack') { const a = lerAtaque(t); if (a) { p.alcance = a.alcance; p.alvo = a.alvo; p.ataque = { bonus: a.bonus, defesa: a.defesa }; } else p.extras.push({ rotulo, texto: t }); }
    else if (base === 'secondary attack') { secundario = true; p.extras.push({ rotulo, texto: t }); }
    else if (base === 'hit') p.acerto = t;
    else if (base === 'miss') p.erro = t;
    else if (base === 'effect') p.efeito = [p.efeito, t].filter(Boolean).join('\n');
    else if (base === 'trigger') p.gatilho = t;
    else if (base === 'requirement') p.requisito = t;
    else if (base === 'special') p.especial = [p.especial, t].filter(Boolean).join(' ');
    else if (base === 'target') p.alvo = t;
    else p.extras.push({ rotulo, texto: t });
  }
}
function corpoAntigo(p, paragrafos) {
  const t = paragrafos.map(txt).join('\n').trim();
  if (!t) return;
  const am = /\+(\d+)\s+vs\.?\s*(AC|Fortitude|Fort|Reflex|Ref|Will)\b/i.exec(t);
  if (!am) { p.efeito = t; return; }
  const def = { fortitude: 'Fort', fort: 'Fort', reflex: 'Ref', ref: 'Ref', will: 'Will', ac: 'AC' }[am[2].toLowerCase()];
  p.ataque = { bonus: +am[1], defesa: def };
  const antes = t.slice(0, am.index), depois = t.slice(am.index + am[0].length).replace(/^\s*;?\s*/, '');
  const al = /(Reach \d+|Melee(?: touch|\s+\d+)?|Ranged(?:\s+\d+(?:\/\d+)?)?|Close (?:burst|blast) \d+|Area (?:burst|wall) \d+ within \d+)/i.exec(antes);
  if (al) p.alcance = al[1];
  const alvo = /\btargets?\s+([^;]+)/i.exec(antes);
  if (alvo) p.alvo = alvo[1].trim();
  const intro = antes.replace(/(Reach \d+|Melee(?: touch|\s+\d+)?|Ranged(?:\s+\d+(?:\/\d+)?)?|Close (?:burst|blast) \d+|Area (?:burst|wall) \d+ within \d+)/i, '').replace(/\btargets?\s+[^;]+/i, '').replace(/[;\s]+/g, ' ').trim();
  if (intro) p.efeito = intro.charAt(0).toUpperCase() + intro.slice(1);
  const mis = /\bMiss:\s*([\s\S]*)$/i.exec(depois);
  p.acerto = (mis ? depois.slice(0, mis.index) : depois).trim().replace(/[;\s]+$/, '');
  if (mis) p.erro = mis[1].trim();
}
function pegar(html, re) { const m = re.exec(html); return m ? txt(m[1]) : ''; }
const numero = (s) => { const m = /(-?\d+)/.exec(String(s)); return m ? +m[1] : 0; };

export function lerMonstro(html, meta = {}) {
  const c = novaCriatura();
  c.nome = txt((/<h1[^>]*>([^<]*)/.exec(html) || [, meta.Name || ''])[1]);
  const tipoStr = pegar(html, /<span class=type>([\s\S]*?)<\/span>/);
  const lv = /<span class=level>([^<]*)(?:<span class=xp>\s*XP\s*([\d,]*))?/.exec(html) || [];
  const nivelM = /Level\s+(\d+)\s*(.*)/i.exec(txt(lv[1] || ''));
  c.nivel = nivelM ? +nivelM[1] : numero(meta.Level);
  const resto = (nivelM ? nivelM[2] : '').trim();
  const grupo = GRUPOS.find((g) => new RegExp(`\\b${g}\\b`, 'i').test(resto)) || GRUPOS.find((g) => g === meta.GroupRole) || 'Standard';
  c.grupo = grupo;
  const fn = FUNCOES.find((f) => new RegExp(`\\b${f}\\b`, 'i').test(meta.CombatRole || resto));
  c.funcao = fn || 'Soldier'; c.semFuncao = !fn;
  c.lider = /leader/i.test(meta.CombatRole || resto);
  const tam = TAMANHOS.find((t) => new RegExp(`^${t}\\b`, 'i').test(tipoStr)) || meta.Size || 'Medium';
  c.tamanho = tam; c.tipoTexto = tipoStr.replace(new RegExp(`^${tam}\\s*`, 'i'), '').replace(/\s+,/g, ',').trim();
  c.xpManual = lv[2] ? +lv[2].replace(/,/g, '') : null;
  if (c.xpManual === xpDe(c.nivel, c.grupo)) c.xpManual = null;

  const v = (re) => { const m = re.exec(html); return m ? m[1] : null; };
  c.pv = numero(v(/<b>HP<\/b>\s*(\d+)/));
  c.iniciativa = numero(v(/<b>Initiative<\/b>\s*([+-]?\d+)/));
  c.ca = numero(v(/<b>AC<\/b>\s*(\d+)/)); c.fort = numero(v(/<b>Fortitude<\/b>\s*(\d+)/)); c.ref = numero(v(/<b>Reflex<\/b>\s*(\d+)/)); c.vont = numero(v(/<b>Will<\/b>\s*(\d+)/));
  for (const [en, k] of Object.entries(ATR_EN)) c.atr[k] = numero(v(new RegExp(`<b>${en}<\\/b>\\s*(\\d+)`, 'i'))) || 10;
  const vel = /<b>Speed<\/b>\s*([^<]*)(?:<td class=rightalign>([^<]*))?/.exec(html);
  c.velocidade = vel ? txt(vel[1]).replace(/[;,]\s*$/, '') : '6';
  const senses = pegar(html, /<b>Senses<\/b>\s*([^<]*)/);
  if (senses) c.sentidos = senses;
  else { const per = pegar(html, /<b>Perception<\/b>\s*([+-]?\d+)/); c.sentidos = [per ? `Perception ${/^[+-]/.test(per) ? per : '+' + per}` : 'Perception +0', vel && vel[2] ? txt(vel[2]) : ''].filter(Boolean).join('; '); }
  c.resistencias = pegar(html, /<b>Resist<\/b>\s*([^<]*)/); c.vulnerabilidades = pegar(html, /<b>Vulnerable<\/b>\s*([^<]*)/); c.imunidades = pegar(html, /<b>Immune<\/b>\s*([^<]*)/);
  c.testesSalvamento = pegar(html, /<b>Saving Throws<\/b>\s*\+?([^<]*)/).replace(/;\s*$/, ''); c.pontosAcao = pegar(html, /<b>Action Points<\/b>\s*([^<]*)/);
  c.pericias = pegar(html, /<b>Skills<\/b>\s*([^<]*)/); c.tendencia = pegar(html, /<b>Alignment<\/b>\s*([^<]*)/); c.idiomas = pegar(html, /<b>\s*Languages<\/b>\s*([^<]*)/);
  c.equipamento = pegar(html, /<b>Equipment<\/b>:?\s*([^<]*)/).replace(/\s+([,.])/g, '$1').trim();
  c.descricao = pegar(html, /<b>Description<\/b>:?\s*([^<]*)/);

  // poderes e características
  const novo = /<h2>/.test(html);
  let secao = '', atual = null, corpo = [];
  const fecha = () => { if (!atual) return; (novo ? corpoNovo : corpoAntigo)(atual, corpo); if (atual.categoria !== 'rasgo' && (atual.acerto || atual.efeito)) atual.dano = extrairDano(atual.acerto || atual.efeito); c.poderes.push(atual); atual = null; corpo = []; };
  for (const m of html.matchAll(/<h2>([^<]+)<\/h2>|<p class='flavor alt'>([\s\S]*?)<\/p>|<p class=flavorIndent>([\s\S]*?)<\/p>/g)) {
    if (m[1] !== undefined) { fecha(); secao = txt(m[1]); continue; }
    if (m[2] !== undefined) {
      if (/<b>\s*(Str|Skills|Equipment|Alignment|Description)\b/.test(m[2])) { fecha(); continue; }
      fecha(); atual = cabecalho(m[2], novo, secao); continue;
    }
    if (atual) corpo.push(m[3]);
  }
  fecha();
  if (!novo) { // formato antigo: poderes sem seção são características
    for (const p of c.poderes) if (!p.acao && p.categoria !== 'rasgo' && !p.uso) p.categoria = 'rasgo';
  }
  c.origem = { cat: 'monster', id: meta.ID || '', nome: meta.Name || c.nome };
  return c;
}

// ------------------------------------------------------------------ textos do monstro em português
// Os campos da criatura são pedaços dos nós de texto do compêndio; traduz pelo dicionário (nó inteiro, sufixo de um nó
// ou lista separada por vírgula/ponto e vírgula). O que não achar fica em inglês. Os números (dano, ataque) já foram extraídos antes.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
let CAMPOS = {}, camposM = 0;
function mapaCampos() {
  try { const arq = path.join(COMPENDIO, 'pt-campos.json'); const m = fs.statSync(arq).mtimeMs; if (m !== camposM) { CAMPOS = JSON.parse(fs.readFileSync(arq, 'utf8')); camposM = m; } } catch { /* sem o arquivo */ }
  return CAMPOS;
}
export function traduzirCampo(s, nos, dic) {
  const t = String(s ?? '').trim();
  if (!t || !/[A-Za-z]{3}/.test(t)) return s;
  const extra = mapaCampos()[t];
  if (extra) return extra;
  const direto = dic[t] ?? dic[': ' + t] ?? dic[t.replace(/[.;]\s*$/, '')];
  if (direto) return direto.replace(/^:\s*/, '');
  // pedaço de um nó: o erro ("Miss: ...") ou o acerto (entre o último ";" e o "Miss:") de um ataque numa linha só
  for (const n of nos) {
    const i = n.indexOf(t);
    if (i <= 0 || !dic[n]) continue;
    const pt = dic[n], antes = n.slice(0, i), depois = n.slice(i + t.length);
    const corteErro = pt.search(/\s*(?:Erro|Errou|Falha):\s*/i);
    if (/\bMiss:\s*$/i.test(antes) && !depois.trim()) { const r = /(?:Erro|Errou|Falha):\s*([\s\S]*)$/i.exec(pt); if (r) return cap(r[1].trim()); continue; }
    if (/;\s*$/.test(antes) && (!depois.trim() || /^\s*Miss:/i.test(depois))) {
      const k = (antes.match(/;/g) || []).length;
      const corpo = /^\s*Miss:/i.test(depois) && corteErro > 0 ? pt.slice(0, corteErro) : pt;
      const partes = corpo.split(';');
      if (partes.length > k) return partes.slice(k).join(';').trim();
    }
  }
  // lista simples: palavras-chave, equipamento, tipo
  if (/^[A-Za-z' -]+(?:[,;] ?[A-Za-z' -]+)*$/.test(t)) {
    const partes = t.split(/([,;] ?)/);
    let ok = 0, tot = 0;
    const out = partes.map((p) => { if (/^[,;] ?$/.test(p)) return p; tot++; const x = p.trim(); const v = dic[x] ?? dic[cap(x)] ?? dic[x.toLowerCase()]; if (v) { ok++; return x === x.toLowerCase() ? v.toLowerCase() : v; } return p; });
    if (ok) return out.join('');
  }
  return s;
}
export function traduzirCriatura(c, html) {
  const dic = comp.dicPT();
  const nos = trechos(html);
  const tr = (s) => traduzirCampo(s, nos, dic);
  for (const k of ['tipoTexto', 'sentidos', 'resistencias', 'vulnerabilidades', 'imunidades', 'pericias', 'idiomas', 'equipamento', 'descricao', 'tendencia']) if (c[k]) c[k] = tr(c[k]);
  for (const p of c.poderes) for (const k of ['palavras', 'alvo', 'acerto', 'erro', 'efeito', 'especial', 'requisito', 'gatilho']) if (p[k]) p[k] = tr(p[k]);
  return c;
}

export function monstroDoCompendio(id, traduzir = true) {
  const d = comp.detalhe('monster', id);
  if (!d) return null;
  const c = lerMonstro(d.html, d.meta);
  c.id = novoId();
  if (traduzir) traduzirCriatura(c, d.html);
  return c;
}

// ------------------------------------------------------------------ textos em português (rótulos e termos fixos)
export function alcancePT(s) {
  return String(s || '').replace(/Area (burst|wall) (\d+) within (\d+)/i, (m, t, n, d) => `área: ${/wall/i.test(t) ? 'muralha' : 'explosão'} ${n} dentro de ${d} quadrados`)
    .replace(/Close burst/i, 'explosão contígua').replace(/Close blast/i, 'rajada contígua').replace(/Ranged/i, 'à distância').replace(/Melee/i, 'corpo a corpo')
    .replace(/Reach/i, 'alcance').replace(/Personal/i, 'pessoal').toLowerCase();
}
const ACAO_PT = { standard: 'ação padrão', move: 'ação de movimento', minor: 'ação menor', free: 'ação livre', 'immediate interrupt': 'interrupção imediata', 'immediate reaction': 'reação imediata', opportunity: 'ação de oportunidade', 'no action': 'sem ação' };
function usoTexto(p) {
  if (p.uso === 'recharge') return p.recarga === 'sangrando' ? 'recarrega quando sangrando' : `recarga ${p.recarga ? [...Array(7 - +p.recarga)].map((_, i) => '⚀⚁⚂⚃⚄⚅'[+p.recarga - 1 + i]).join('') : ''}`.trim();
  return USO_PT[p.uso] || '';
}
export const acaoDoPoder = (p) => p.acao || ({ padrao: 'standard', movimento: 'move', menor: 'minor', livre: 'free', gatilho: 'immediate reaction' })[p.categoria] || '';

// ------------------------------------------------------------------ macro do Roll20 de um poder da criatura
export function macroPoder(c, p) {
  const t = [];
  const tag = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') t.push(`{{${k}=${seguro(v)}}}`); };
  const grupo = p.uso === 'at-will' ? 'atwill' : p.uso === 'daily' ? 'daily' : (p.uso === 'encounter' || p.uso === 'recharge') ? 'encounter' : 'other';
  t.push('&{template:dnd4epower}', `{{${grupo}=1}}`);
  tag('name', p.nome); tag('class', c.nome); tag('level', c.nivel);
  const kws = String(p.palavras || '').split(/,\s*/).filter(Boolean).map((x) => x.toLowerCase());
  const tipo = usoTexto(p) || (p.categoria === 'rasgo' ? 'característica' : '');
  if (tipo) t.push(`{{type=${seguro(tipo)}${kws.length ? ' ♦ ' : ''}}}`);
  tag('keywords', kws.join(', '));
  const acao = ACAO_PT[acaoDoPoder(p)] || (p.categoria === 'rasgo' ? '' : '');
  const alcance = alcancePT(p.alcance);
  if (acao) t.push(`{{action=${seguro(acao)}${alcance ? ' ♦ ' : ''}}}`);
  tag('range', alcance);
  tag('requirement', p.requisito); tag('trigger', p.gatilho); tag('target', p.alvo);
  const dano = String(p.dano || '').trim();
  if (p.ataque && p.ataque.bonus !== undefined && p.ataque.bonus !== '') {
    const atk = (nome) => `{{${nome}=[[ 1d20 + ${+p.ataque.bonus} ]] vs **${DEF_CURTA[String(p.ataque.defesa).toLowerCase()] || p.ataque.defesa}**}}`;
    t.push(atk('attack'));
    if (/burst|blast|wall|area/i.test(p.alcance || '') && /\b(each|every|all|creatures|enemies|allies)\b/i.test(p.alvo || '')) {
      t.push('{{multiattacktoggle=[[?{Number of Attacks|2}]]}}');
      for (let n = 2; n <= 9; n++) t.push(atk(`multiattack${n}`));
    }
  }
  if (dano) {
    t.push(`{{damage=[[ ${seguro(dano)} ]] de dano.}}`);
    t.push(`{{critical=[[ ${seguro(danoMaximo(dano))} ]] de dano.}}`);
  }
  const semDano = (s) => String(s || '').replace(/\(\s*crit[^)]*\)/gi, '').replace(/(\d+d\d+(?:\s*[+-]\s*\d+)?|\b\d+\b)\s+(?:[a-z]+(?:, [a-z]+)*\s+)?damage[.,]?\s*(?:plus\s+)?/gi, '').replace(/(\d+d\d+(?:\s*[+-]\s*\d+)?|\b\d+\b)\s+de\s+dano(?:\s+(?:de|do|da)\s+[a-zçãáéíóúê]+)?[.,]?\s*(?:mais\s+)?/gi, '').replace(/^\s*(and|plus|e|mais)\s+/i, '').trim();
  const acerto = dano ? semDano(p.acerto) : p.acerto;
  tag('hiteffect', acerto && acerto.length > 2 ? acerto : '');
  tag('miss', p.erro);
  tag('effect', p.efeito);
  tag('special', p.especial);
  for (const e of p.extras || []) tag(`**${e.rotulo}:**`, e.texto);
  return t.join(' ');
}

// ------------------------------------------------------------------ bloco de estatísticas (HTML)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const DEF_PT = { ac: 'CA', fort: 'Fortitude', fortitude: 'Fortitude', ref: 'Reflexos', reflex: 'Reflexos', will: 'Vontade', vont: 'Vontade' };
const semPontoVirgula = (s) => String(s ?? '').replace(/[;s]+$/, '');
export function blocoHtml(c) {
  const d = derivar(c);
  const fn = c.funcao === 'None' ? '' : (FUNCAO_PT[c.funcao] || c.funcao);
  const titulo = `Nível ${c.nivel} ${c.grupo === 'Standard' ? '' : GRUPO_PT[c.grupo] + ' '}${fn}${c.lider ? ' (Líder)' : ''}`.replace(/\s+/g, ' ').trim();
  const linhaAtq = (p) => {
    const a = p.ataque ? `${p.alcance ? esc(alcancePT(p.alcance)) : ''}${p.alvo ? ' (' + esc(p.alvo) + ')' : ''}; <b>+${p.ataque.bonus}</b> vs. ${esc(DEF_PT[String(p.ataque.defesa).toLowerCase()] || p.ataque.defesa)}` : '';
    return [p.requisito && `<i>Requisito:</i> ${esc(p.requisito)}`, p.gatilho && `<i>Gatilho:</i> ${esc(p.gatilho)}`, a && `<i>Ataque:</i> ${a}`,
      !p.ataque && p.alcance && p.uso !== 'aura' ? `<i>Alcance:</i> ${esc(alcancePT(p.alcance))}` : '', p.acerto && `<i>Acerto:</i> ${esc(p.acerto)}`, p.dano && !p.acerto ? `<i>Dano:</i> ${esc(p.dano)}` : '', p.erro && `<i>Erro:</i> ${esc(p.erro)}`,
      p.efeito && `<i>Efeito:</i> ${esc(p.efeito).replace(/\n/g, '<br>')}`, p.especial && `<i>Especial:</i> ${esc(p.especial)}`,
      ...(p.extras || []).map((e) => `<i>${esc(e.rotulo)}:</i> ${esc(e.texto)}`)].filter(Boolean).map((x) => `<p class="sb-linha">${x}</p>`).join('');
  };
  const secoes = CATEGORIAS.map((cat) => {
    const lista = c.poderes.filter((p) => p.categoria === cat);
    if (!lista.length) return '';
    return `<h2>${PLURAL_CAT[cat] || CATEGORIA_PT[cat]}</h2>` + lista.map((p) => `<div class="sb-poder"><p class="sb-cab ${p.uso}"><b>${esc(p.nome)}</b>${p.palavras ? ` <small>(${esc(p.palavras)})</small>` : ''}${usoTexto(p) ? ` ✦ <b>${esc(usoTexto(p))}</b>` : ''}${p.uso === 'aura' && p.alcance ? ' ' + esc(p.alcance) : ''}</p>${linhaAtq(p)}</div>`).join('');
  }).join('');
  const atr = ATRIBUTOS.map((k) => `<b>${{ for: 'For', con: 'Con', des: 'Des', int: 'Int', sab: 'Sab', car: 'Car' }[k]}</b> ${c.atr[k]} (${d.bonus[k] >= 0 ? '+' : ''}${d.bonus[k]})`);
  return `<div class="sb"><h1 class="sb-h"><span>${esc(c.nome)}</span><span class="sb-nv">${esc(titulo)}</span><span class="sb-xp">XP ${d.xp}</span></h1>
    <div class="sb-tipo">${esc(TAMANHO_PT[c.tamanho] || c.tamanho)} ${esc(c.tipoTexto)}</div>
    <table class="sb-tab"><tr><td><b>PV</b> ${c.pv}${c.grupo === 'Minion' ? '; um ataque que erra nunca fere um lacaio' : `; <b>Sangrando</b> ${d.sangrando}`}</td><td class="dir"><b>Iniciativa</b> ${c.iniciativa >= 0 ? '+' : ''}${c.iniciativa}</td></tr>
    <tr><td><b>CA</b> ${c.ca}, <b>Fortitude</b> ${c.fort}, <b>Reflexos</b> ${c.ref}, <b>Vontade</b> ${c.vont}</td><td class="dir">${esc(c.sentidos)}</td></tr>
    <tr><td><b>Deslocamento</b> ${esc(c.velocidade)}</td><td class="dir">${[c.pontosAcao && `<b>Pontos de ação</b> ${esc(c.pontosAcao)}`, c.testesSalvamento && `<b>Testes de resistência</b> +${esc(String(c.testesSalvamento).replace(/^\+/, ''))}`].filter(Boolean).join('; ')}</td></tr>
    ${(c.resistencias || c.vulnerabilidades || c.imunidades) ? `<tr><td colspan="2">${[c.imunidades && `<b>Imune</b> ${esc(semPontoVirgula(c.imunidades))}`, c.resistencias && `<b>Resistência</b> ${esc(semPontoVirgula(c.resistencias))}`, c.vulnerabilidades && `<b>Vulnerável</b> ${esc(semPontoVirgula(c.vulnerabilidades))}`].filter(Boolean).join('; ')}</td></tr>` : ''}</table>
    ${secoes}
    <div class="sb-rodape">${c.pericias ? `<p><b>Perícias</b> ${esc(c.pericias)}</p>` : ''}<p>${atr.join(' &nbsp; ')}</p>
    <p><b>Tendência</b> ${esc(c.tendencia)} &nbsp; <b>Idiomas</b> ${esc(c.idiomas || '—')}</p>${c.equipamento ? `<p><b>Equipamento</b>: ${esc(c.equipamento)}</p>` : ''}</div></div>`;
}

// ------------------------------------------------------------------ exportação para o Roll20 (mesmo formato da ficha do personagem)
export function exportarRoll20Criatura(c) {
  const d = derivar(c);
  const A = {};
  const set = (k, v) => { if (v !== undefined && v !== null && v !== '') A[k] = v; };
  set('character_name', c.nome); set('level', +c.nivel || 1); set('xp', d.xp);
  set('class', `${FUNCAO_PT[c.funcao] || c.funcao} ${GRUPO_PT[c.grupo] || ''}`.trim()); set('race', c.tipoTexto);
  set('alignment', c.tendencia); set('size', TAMANHO_PT[c.tamanho] || c.tamanho); set('lang', c.idiomas);
  for (const k of ATRIBUTOS) set(ATR_FICHA[k], +c.atr[k] || 10);
  A.hp = { c: +c.pv || 0, m: +c.pv || 0 }; A['hp-bloodied'] = d.sangrando; A.surges = { c: 0, m: 0 }; A['surge-value'] = Math.floor((+c.pv || 0) / 4);
  for (const [p, total] of [['ac', c.ca], ['fort', c.fort], ['ref', c.ref], ['will', c.vont]]) {
    for (const s of ['ability', 'armor', 'class', 'feat', 'enh', 'misc2']) A[`${p}-${s}`] = 0;
    A[`${p}-misc`] = (+total || 0) - 10 - d.meio;
  }
  A['init-highest'] = '@{dexterity-mod}'; A['init-feat'] = 0; A['init-item'] = 0; A['init-misc'] = (+c.iniciativa || 0) - d.mods.des - d.meio;
  A['speed-base'] = numero(c.velocidade) || 6; A['speed-armor'] = 0; A['speed-item'] = 0; A['speed-misc'] = 0;
  for (const m of String(c.pericias || '').matchAll(/([A-Za-z]+)\s*([+-]\d+)/g)) {
    const nome = PERICIAS.find((x) => x.toLowerCase() === m[1].toLowerCase()); if (!nome) continue;
    const ab = { Acrobatics: 'des', Arcana: 'int', Athletics: 'for', Bluff: 'car', Diplomacy: 'car', Dungeoneering: 'sab', Endurance: 'con', Heal: 'sab', History: 'int', Insight: 'sab', Intimidate: 'car', Nature: 'sab', Perception: 'sab', Religion: 'int', Stealth: 'des', Streetwise: 'car', Thievery: 'des' }[nome];
    const k = nome.toLowerCase(); A[`${k}-trained`] = 0; A[`${k}-pen`] = 0; A[`${k}-misc`] = +m[2] - d.bonus[ab];
  }
  const res = [c.imunidades && `Imune: ${c.imunidades}`, c.resistencias && `Resistência: ${c.resistencias}`, c.vulnerabilidades && `Vulnerável: ${c.vulnerabilidades}`].filter(Boolean).join('; ');
  set('resistances', res); set('saving-throw-mods', c.testesSalvamento ? `+${String(c.testesSalvamento).replace(/^\+/, '')}` : ''); set('special-movement', c.velocidade);
  const ACAO_FICHA = { standard: 'Standard', move: 'Move', minor: 'Minor', free: 'Free Action', 'immediate interrupt': 'Immediate Interrupt', 'immediate reaction': 'Immediate Reaction', opportunity: 'Opportunity Action', 'no action': 'No Action' };
  const poderes = [], habilidades = [], tracos = [];
  const nomeHab = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  for (const p of c.poderes) {
    const macro = macroPoder(c, p);
    if (p.categoria === 'rasgo') { tracos.push(`${p.nome}${p.palavras ? ' (' + p.palavras + ')' : ''}: ${[p.efeito, p.acerto, p.especial].filter(Boolean).join(' ').slice(0, 300)}`); habilidades.push({ nome: nomeHab('Rasgo-' + p.nome), macro }); continue; }
    const item = { nome: p.nome, acao: ACAO_FICHA[acaoDoPoder(p)] || 'Standard', alcance: alcancePT(p.alcance), nivel: String(c.nivel), uso: p.uso === 'daily' ? 'Daily' : p.uso === 'at-will' ? 'At-Will' : 'Encounter', macro };
    if (poderes.length < 100) poderes.push(item); else habilidades.push({ nome: nomeHab('Poder-' + p.nome), macro });
  }
  const vistos = new Set();
  const hab = habilidades.filter((h) => h.nome && !vistos.has(h.nome.toLowerCase()) && vistos.add(h.nome.toLowerCase()));
  const bio = [c.descricao, c.taticas && 'Táticas: ' + c.taticas, c.equipamento && 'Equipamento: ' + c.equipamento].filter(Boolean).join('\n\n');
  return { formato: 'grimorio-roll20', versao: 1, nome: c.nome, atributos: A, poderes, habilidades: hab, talentos: [], classeFeats: tracos, racaFeats: [], inventario: [], bio, avisos: [] };
}

export function resumoLista(c) {
  const fn = c.funcao === 'None' ? '' : (FUNCAO_PT[c.funcao] || c.funcao);
  return `${c.grupo === 'Standard' ? '' : GRUPO_PT[c.grupo] + ' '}${fn}`.trim();
}

// ------------------------------------------------------------------ "colcha de retalhos": índice de poderes de TODOS os
// monstros do compêndio, para escolher poder a poder (não o monstro inteiro) e misturar de vários. Classifica o dano em
// baixo/médio/alto comparando com a tabela Dano por Nível (DANO_NIVEL) do próprio nível do monstro; características
// (sem dano) ficam numa faixa própria ("traço"), separadas das faixas de dano.
function mediaExpressao(expr) {
  let total = 0;
  for (const termo of String(expr || '').split('+').map((s) => s.trim()).filter(Boolean)) {
    const dado = /^(\d+)d(\d+)$/.exec(termo);
    if (dado) total += +dado[1] * (+dado[2] + 1) / 2;
    else if (/^-?\d+$/.test(termo)) total += +termo;
  }
  return total;
}
let INDICE_PODERES = null, indiceMtime = 0;
export function indicePoderesMonstros() {
  const d = comp.carregar('monster');
  if (!d) return [];
  const arq = new URL('./compendio/monster.json', import.meta.url);
  let m = 0; try { m = fs.statSync(arq).mtimeMs; } catch { /* sem arquivo */ }
  if (INDICE_PODERES && m === indiceMtime) return INDICE_PODERES;
  const out = [];
  for (const l of d.linhas) {
    const html = d.dados[l.ID]; if (!html) continue;
    let c; try { c = lerMonstro(html, l); traduzirCriatura(c, html); } catch { continue; }
    const nivel = Math.max(1, Math.min(30, +c.nivel || 1));
    const esperado = mediaExpressao(DANO_NIVEL[nivel - 1][0]);
    for (const p of c.poderes) {
      const faixa = p.categoria === 'rasgo' ? 'traco' : p.dano ? (mediaExpressao(p.dano) < esperado * 0.8 ? 'baixo' : mediaExpressao(p.dano) > esperado * 1.2 ? 'alto' : 'medio') : '';
      out.push({ monstroId: l.ID, monstro: l.Name, nivel, funcao: c.funcao, grupo: c.grupo, faixa, poder: p });
    }
  }
  INDICE_PODERES = out; indiceMtime = m;
  return out;
}
export function buscarPoderesMonstro(f = {}) {
  const idx = indicePoderesMonstros();
  const q = comp.norm(f.q || '');
  let r = idx;
  if (q) r = r.filter((x) => comp.norm(x.poder.nome).includes(q) || comp.norm(x.monstro).includes(q) || comp.norm(`${x.poder.efeito} ${x.poder.acerto} ${x.poder.palavras}`).includes(q));
  if (f.tipo) r = r.filter((x) => x.faixa === f.tipo);
  if (f.categoria) r = r.filter((x) => x.poder.categoria === f.categoria);
  if (f.nivelMax) r = r.filter((x) => x.nivel <= +f.nivelMax);
  return { total: r.length, itens: r.slice(0, Math.min(f.limite || 100, 300)) };
}
