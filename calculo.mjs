// Motor de cálculo da ficha (mesma ideia do Character Builder): soma bônus tipados de raça, classe, talentos, itens equipados…
// Fontes: compendio\regras.json (extraído das regras do CB: fórmulas por nível e bônus) + texto do iws.mx como reserva
// para elementos do núcleo que só existem no arquivo fechado do CB (ex.: Ranger).
import fs from 'node:fs';
import path from 'node:path';
import { COMPENDIO } from './caminhos.mjs';
import { carregar, acharPorNome, norm } from './compendio.mjs';
import { linhasPropriedade, interpretar } from './passivas.mjs';

let REGRAS = null;
const regras = () => {
  if (!REGRAS) { try { REGRAS = JSON.parse(fs.readFileSync(path.join(COMPENDIO, 'regras.json'), 'utf8')); } catch { REGRAS = { el: {}, nome: {} }; } }
  return REGRAS;
};
export const recarregarRegras = () => { REGRAS = null; };

export const ATR = ['for', 'con', 'des', 'int', 'sab', 'car'];
const ATR_EN = { for: 'strength', con: 'constitution', des: 'dexterity', int: 'intelligence', sab: 'wisdom', car: 'charisma' };
const EN_ATR = Object.fromEntries(Object.entries(ATR_EN).flatMap(([k, v]) => [[v, k], [v.slice(0, 3), k]]));
export const PERICIAS = [['Acrobatics', 'des'], ['Arcana', 'int'], ['Athletics', 'for'], ['Bluff', 'car'], ['Diplomacy', 'car'], ['Dungeoneering', 'sab'],
  ['Endurance', 'con'], ['Heal', 'sab'], ['History', 'int'], ['Insight', 'sab'], ['Intimidate', 'car'], ['Nature', 'sab'], ['Perception', 'sab'],
  ['Religion', 'int'], ['Stealth', 'des'], ['Streetwise', 'car'], ['Thievery', 'des']];
export const PENALIZA = new Set(['Acrobatics', 'Athletics', 'Endurance', 'Stealth', 'Thievery']); // penalidade de armadura

const mod = (s) => Math.floor((s - 10) / 2);
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : d; };
const texto = (h) => String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const camp = (h, rotulo) => { const m = new RegExp(rotulo + '\\s*:?\\s*([^|]*?)\\s*(?:\\||$)', 'i').exec(h); return m ? m[1].trim() : ''; };

// ---------- leitura de dados do iws (reserva e itens base)
const entradaHtml = (cat, id) => carregar(cat)?.dados?.[id] || '';
const linhaPorId = (cat, id) => carregar(cat)?.linhas.find((l) => l.ID === id);

function infoClasseHtml(html) {
  const t = texto(html);
  const g = (re) => { const m = re.exec(t); return m ? m[1] : null; };
  const pv1 = g(/Hit Points at 1st Level\s*:?\s*(\d+)/i);
  const pvn = g(/Hit Points per Level Gained\s*:?\s*(\d+)/i);
  const surtos = g(/Healing Surges per Day\s*:?\s*(\d+)/i);
  const def = /Bonus to Defense\s*:?\s*([^.]*)/i.exec(t)?.[1] || '';
  const bonus = {};
  for (const m of def.matchAll(/\+(\d)\s*(Fortitude|Reflex|Will)/gi)) bonus[m[2].toLowerCase()] = +m[1];
  const arm = /Armor Proficiencies\s*:?\s*([^.]*)/i.exec(t)?.[1] || '';
  const arma = /Weapon Proficiencies\s*:?\s*([^.]*)/i.exec(t)?.[1] || '';
  return { pv1: pv1 && +pv1, pvn: pvn && +pvn, surtos: surtos && +surtos, bonus, arm: arm.toLowerCase(), arma: arma.toLowerCase() };
}
function infoRacaHtml(html) {
  const t = texto(html);
  const velocidade = /Speed\s*:?\s*(\d+)\s*squares?/i.exec(t)?.[1];
  const abil = /Ability Scores?\s*:?\s*([^.]*)/i.exec(t)?.[1] || '';
  const pericias = {};
  const sb = /Skill Bonuses\s*:?\s*([^.]*)/i.exec(t)?.[1] || '';
  for (const m of sb.matchAll(/\+(\d)\s*([A-Z][a-z]+)/g)) pericias[m[2]] = +m[1];
  const fixos = {}, opcoes = [];
  for (const m of abil.matchAll(/\+(\d)\s*([A-Za-z]+(?:\s*(?:,|or)\s*(?:\+\d\s*)?[A-Za-z]+)*)/g)) {
    const nomes = [...m[2].matchAll(/[A-Za-z]{3,}/g)].map((x) => EN_ATR[x[0].toLowerCase()]).filter(Boolean);
    if (nomes.length === 1) fixos[nomes[0]] = (fixos[nomes[0]] || 0) + +m[1];
    else if (nomes.length > 1) opcoes.push({ valor: +m[1], entre: [...new Set(nomes)] });
  }
  return { velocidade: velocidade && +velocidade, fixos, opcoes, pericias, texto: abil };
}

export function infoRaca(p) { // usado pela interface para sugerir os bônus de atributo
  if (!p.raca?.id) return null;
  return infoRacaHtml(entradaHtml('race', p.raca.id));
}

// ---------- itens base (armaduras, armas) a partir do HTML do iws
const TIPOS_ARMADURA = { cloth: 'cloth', leather: 'leather', hide: 'hide', chainmail: 'chain', chain: 'chain', scale: 'scale', plate: 'plate' };
export function infoArmadura(id) {
  const l = linhaPorId('armor', id); if (!l) return null;
  const t = texto(entradaHtml('armor', id));
  const tipo = (l.Type || '').toLowerCase();
  const escudo = /shield/i.test(tipo) || /Shield Bonus/i.test(t);
  const bonus = num(/(?:AC|Shield) Bonus\s*:?\s*\+?(-?\d+)/i.exec(t)?.[1]);
  const chk = num(/Check\s*:?\s*(-?\d+)/i.exec(t)?.[1]);
  const vel = num(/Speed\s*:?\s*(-?\d+)/i.exec(t)?.[1]);
  const cat = escudo ? (/heavy/i.test(tipo) ? 'heavy' : 'light') : (TIPOS_ARMADURA[tipo] || tipo);
  return { nome: l.Name, escudo, bonus, check: chk, velocidade: vel, tipo: cat, mundana: /mundane/i.test(l.Rarity || '') };
}
export function infoArma(cat, id) {
  const l = linhaPorId(cat, id); if (!l) return null;
  const h = entradaHtml(cat, id);
  const t = texto(h);
  const dano = /Damage\s*:?\s*(\d+d\d+)/i.exec(t)?.[1] || '';
  const prof = num(/Proficient\s*:?\s*\+?(\d+)/i.exec(t)?.[1]);
  const grupo = (l.Type || '').toLowerCase();
  const distancia = /\b(ranged|bow|crossbow|sling|thrown|blowgun)\b/i.test(t.slice(0, 200)) || /bow|sling|crossbow|blowgun/.test(grupo);
  return { nome: l.Name, dano, prof, grupo, distancia, mundana: /mundane/i.test(l.Rarity || ''), texto: t.slice(0, 160) };
}

// variantes de um item do iws: lê "Lvl N | +K | custo" do HTML
export function variantes(cat, id) {
  const h = entradaHtml(cat, id);
  const t = h.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  const out = [];
  for (const m of t.matchAll(/Lvl (\d+)\|(?:\+?(\d+)\|)?([\d,]+) gp/g)) out.push({ nivel: +m[1], mais: +(m[2] || 0), custo: +m[3].replace(/,/g, '') }); // "+N" é opcional (augments não têm aprimoramento)
  if (!out.length) { // itens sem variação
    const l = linhaPorId(cat, id);
    const c = (Array.isArray(l?.Cost) ? l.Cost[0] : l?.Cost) || '';
    const nv = num(l?.Level, 0);
    const m = /Level (\d+)/.exec(t);
    out.push({ nivel: m ? +m[1] : nv, mais: 0, custo: num(String(c).replace(/,/g, '')) });
  }
  return out.sort((a, b) => a.nivel - b.nivel);
}

// Quais encantamentos servem para um equipamento base? (ex.: "Agile Armor" = "Chain, scale or plate")
export function filtroCompat(cat, base) {
  if (cat === 'armor') {
    const a = infoArmadura(base.id); if (!a) return null;
    return (l) => {
      const t = String(l.Type || '').toLowerCase();
      if (a.escudo) return /shield/.test(t) && (!/(light|heavy) shield/.test(t) || t.includes(a.tipo));
      if (/shield/.test(t)) return false;
      const toks = t.split(/,| or /).map((x) => x.trim()).filter(Boolean);
      return toks.some((x) => x === 'any' || x === a.tipo || (a.tipo === 'chain' && x === 'chainmail') || (['cloth', 'leather', 'hide'].includes(a.tipo) && x === 'light'));
    };
  }
  if (cat === 'weapon') {
    const w = infoArma('weapon', base.id); if (!w) return null;
    const grupos = w.grupo.split(/,| or /).map((x) => x.trim()).filter(Boolean);
    return (l) => {
      const toks = String(l.Type || '').toLowerCase().split(/,| or /).map((x) => x.trim()).filter(Boolean);
      return toks.some((x) => x === 'any' || (x === 'any melee' && !w.distancia) || (x === 'any ranged' && w.distancia) || grupos.includes(x) || x === w.nome.toLowerCase());
    };
  }
  return null;
}

// ---------- expressões e requisitos
const norma = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

function avaliaExpr(expr, v) {
  let s = String(expr).trim();
  let sinal = 1;
  if (s[0] === '+') s = s.slice(1).trim(); else if (s[0] === '-') { sinal = -1; s = s.slice(1).trim(); }
  if (/^\d+(\.\d+)?$/.test(s)) return sinal * parseFloat(s);
  return sinal * v(s);
}

// ---------- o motor
export function calcular(P) {
  const R = regras();
  const nivel = Math.max(1, Math.min(30, +P.nivel || 1));
  const avisos = [];
  const ativos = [];            // { id, n, t, s:[], origem }
  const stats = [];             // { stat, expr, tipo, req, wear, nwear, fonte }
  const tags = new Set();       // nomes ativos (para "requires")
  const vestindo = new Set();   // tokens de "wearing"
  const origem = (fonte) => fonte;

  const addTag = (n) => {
    if (!n) return;
    tags.add(norma(n));
    const alt = /^(.+?):\s*(.+)$/.exec(n); // "Armor Proficiency: Chainmail" (iws) = "Armor Proficiency (Chainmail)" (regras do CB)
    if (alt) tags.add(norma(`${alt[1]} (${alt[2]})`));
  };
  const usaElemento = (id, fonte, vis = new Set()) => {
    const e = R.el[id]; if (!e || vis.has(id)) return;
    vis.add(id);
    addTag(e.n); addTag(id);
    for (const q of e.s) stats.push({ stat: q[0], expr: q[1], tipo: q[2], req: q[3], wear: q[4], nwear: q[5], fonte });
    for (const [gid] of e.g) usaElemento(gid, fonte, vis);
  };
  const porNome = (tipo, nome) => R.nome[tipo + '|' + norm(nome)];
  const sint = (stat, expr, tipo, fonte, extra = {}) => stats.push({ stat, expr: String(expr), tipo: tipo || '', req: extra.req || '', wear: '', nwear: extra.nwear || '', fonte });

  // níveis (fórmulas-base) e tier
  for (let i = 1; i <= nivel; i++) usaElemento('ID_INTERNAL_LEVEL_' + i, 'Regras base');
  addTag(nivel >= 21 ? 'Epic Tier' : nivel >= 11 ? 'Paragon Tier' : 'Heroic Tier');
  if (nivel >= 11) addTag('Paragon Tier'); if (nivel >= 21) addTag('Epic Tier'); addTag('Heroic Tier');

  // atributos
  const atr = { for: 0, con: 0, des: 0, int: 0, sab: 0, car: 0 };
  const a = P.atr || { base: P.atributos || {}, racial: {}, aumentos: {} };
  const detAtr = {};
  for (const k of ATR) {
    const b = +a.base?.[k] || 10, r = +a.racial?.[k] || 0;
    let n = 0; const aum = a.aumentos || {};
    for (const [lv, lista] of Object.entries(aum)) if (+lv <= nivel) n += (lista || []).filter((x) => x === k).length;
    atr[k] = b + r + n; // os +1 de todos os atributos nos níveis 11 e 21 vêm das regras de nível (elementos "Level")
    detAtr[k] = { base: b, racial: r, niveis: n };
  }

  // classe / raça / outros selecionados
  const info = { classe: null, raca: null };
  const classeId = P.classe?.nome && porNome('Class', P.classe.nome);
  if (P.classe?.nome) {
    addTag(P.classe.nome);
    if (classeId) usaElemento(classeId, 'Classe: ' + P.classe.nome);
    const ci = P.classe.id ? infoClasseHtml(entradaHtml('class', P.classe.id)) : null;
    info.classe = ci;
    const temPv = classeId && R.el[classeId].s.some((q) => q[0] === '_LEVEL-ONE-HPS');
    if (ci && !temPv) {
      if (ci.pv1) sint('_LEVEL-ONE-HPS', '+' + ci.pv1, '', 'Classe: ' + P.classe.nome);
      if (ci.pvn) sint('_PER-LEVEL-HPS', '+' + ci.pvn, '', 'Classe: ' + P.classe.nome);
      if (ci.surtos) sint('Healing Surges', '+' + ci.surtos, '', 'Classe: ' + P.classe.nome);
    }
    const temDef = classeId && R.el[classeId].s.some((q) => /Defense Class Bonus/.test(q[0]));
    if (ci && !temDef) {
      for (const [d, nome] of [['fortitude', 'Fortitude Defense'], ['reflex', 'Reflex Defense'], ['will', 'Will Defense']]) if (ci.bonus[d]) sint(nome + ' Class Bonus', '+' + ci.bonus[d], '', 'Classe: ' + P.classe.nome);
    }
    if (ci?.arm) { // proficiências de armadura/escudo como tags
      for (const [pal, nome] of [['cloth', 'Cloth'], ['leather', 'Leather'], ['hide', 'Hide'], ['chainmail', 'Chainmail'], ['scale', 'Scale'], ['plate', 'Plate']]) if (ci.arm.includes(pal)) addTag(`Armor Proficiency (${nome})`);
      if (/light shield/.test(ci.arm)) addTag('Shield Proficiency (Light)');
      if (/heavy shield/.test(ci.arm)) addTag('Shield Proficiency (Heavy)');
    }
  }
  if (P.raca?.nome) {
    addTag(P.raca.nome);
    const rid = porNome('Race', P.raca.nome);
    if (rid) usaElemento(rid, 'Raça: ' + P.raca.nome);
    const ri = P.raca.id ? infoRacaHtml(entradaHtml('race', P.raca.id)) : null;
    info.raca = ri;
    const temVel = rid && R.el[rid].s.some((q) => q[0] === 'Speed');
    if (ri?.velocidade && !temVel) sint('Speed', '+' + ri.velocidade, '', 'Raça: ' + P.raca.nome);
    if (ri) for (const [per, v] of Object.entries(ri.pericias)) if (!(rid && R.el[rid].s.some((q) => q[0] === per + ' Misc'))) sint(per + ' Misc', '+' + v, 'Racial', 'Raça: ' + P.raca.nome);
  }
  // características de classe/raça: ids vindos do .dnd4e (exatos) ou, em fichas criadas aqui, deduzidas do texto do compêndio
  if (Array.isArray(P.extras)) {
    for (const x of P.extras) { addTag(x.nome); if (x.id && R.el[x.id]) usaElemento(x.id, x.nome); }
  } else {
    if (info.classe && P.classe?.id) {
      const lista = /Class features\s*:?\s*<\/b>\s*([^<]*)/i.exec(entradaHtml('class', P.classe.id))?.[1] || '';
      for (const nome of lista.split(/,|\band\b/).map((t) => t.replace(/\./g, '').trim()).filter(Boolean)) {
        addTag(nome); const id = porNome('Class Feature', nome); if (id) usaElemento(id, 'Característica de classe: ' + nome);
      }
    }
    const rid2 = P.raca?.nome && porNome('Race', P.raca.nome);
    const racaTemDef = rid2 && R.el[rid2].s.some((q) => /Defense/.test(q[0]));
    if (P.raca?.id && !racaTemDef) { // "+1 racial bonus to Fortitude, Reflex, and Will"
      const t = texto(entradaHtml('race', P.raca.id));
      for (const m of t.matchAll(/\+(\d) (?:racial )?bonus to (Fortitude|Reflex|Will|AC)(?:,? (?:and )?(Fortitude|Reflex|Will))?(?:,? (?:and )?(Fortitude|Reflex|Will))?/gi)) {
        for (const d of [m[2], m[3], m[4]].filter(Boolean)) {
          const nome = { fortitude: 'Fortitude Defense', reflex: 'Reflex Defense', will: 'Will Defense', ac: 'AC' }[d.toLowerCase()];
          sint(nome, '+' + m[1], 'Racial', 'Raça: ' + P.raca.nome);
        }
      }
    }
  }
  for (const [chave, tipo] of [['paragon', 'Paragon Path'], ['destino', 'Epic Destiny'], ['tema', 'Theme'], ['antecedente', 'Background'], ['divindade', 'Deity']]) {
    const x = P[chave]; if (!x?.nome) continue;
    addTag(x.nome);
    const id = porNome(tipo, x.nome); if (id) usaElemento(id, `${x.nome}`);
  }
  for (const f of P.talentos || []) {
    addTag(f.nome);
    const id = porNome('Feat', f.nome); if (id) usaElemento(id, 'Talento: ' + f.nome);
  }

  // equipamentos equipados
  const eq = (P.itens || []).filter((i) => i.equipado);
  let corpo = null, escudo = null;
  const ataques = [];
  const detItens = [];
  const passivas = [];
  for (const it of eq) {
    const aviso = (m) => avisos.push(`${it.nome}: ${m}`);
    const nvVar = it.variante?.nivel;
    if (nvVar && nvVar > nivel) aviso(`item de nível ${nvVar}, acima do nível do personagem (${nivel})`);
    if (it.cat === 'armor' && it.base?.id) {
      const ar = infoArmadura(it.base.id);
      if (!ar) continue;
      if (ar.escudo) escudo = { ...ar, it }; else corpo = { ...ar, it };
    } else if ((it.cat === 'weapon') && it.base?.id) {
      const w = infoArma('weapon', it.base.id);
      if (w) { ataques.push({ it, w }); (w.grupo.split(/[,/]| or /).map((x) => x.trim()).filter(Boolean)).forEach((g) => vestindo.add('weapon:' + g)); }
    }
    // encantamento (ou item mágico avulso) → elemento do CB
    const ench = it.ench || (it.cat === 'item' ? { nome: it.nome, mais: it.variante?.mais, nivel: nvVar } : null);
    if (ench?.nome) {
      const mais = ench.mais || 0;
      const lvItem = ench.nivel || nivel;
      const tier = lvItem >= 21 ? 'epic' : lvItem >= 11 ? 'paragon' : 'heroic';
      const cand = [mais ? `${ench.nome} +${mais}` : '', ench.nome, `${ench.nome} (${tier} tier)`, `${ench.nome} (level ${ench.nivel || ''})`,
        ...[3, 8, 13, 18, 23, 28].filter((n) => n <= lvItem).reverse().map((n) => `${ench.nome} (level ${n})`)];
      let id = null;
      for (const c of cand) { if (!c) continue; id = porNome('Magic Item', c); if (id) break; }
      const refItem = it.ench?.id ? { cat: it.ench.cat, id: it.ench.id } : it.ref?.id ? it.ref : null;
      if (refItem) { // passivas escritas em texto ("+2 de bônus de item em Acrobacia"): soma o que não tem condição e só lista o resto
        const pas = interpretar(linhasPropriedade(refItem.cat, refItem.id, lvItem), mais);
        if (!id) for (const x of pas.aplicaveis) sint(x.stat, '+' + x.valor, x.tipo, `${ench.nome} (passiva)`);
        if (pas.aplicaveis.length || pas.situacionais.length || pas.resistencias.length) passivas.push({ item: ench.nome + (mais ? ' +' + mais : ''), aplicadas: id ? [] : pas.aplicaveis, jaNasRegras: !!id, situacionais: pas.situacionais, resistencias: pas.resistencias });
      }
      if (id) usaElemento(id, `${ench.nome}${mais ? ' +' + mais : ''}`);
      else if (mais && it.cat === 'armor') sint('Armor Class', '+' + mais, 'Enhancement', `${it.nome} +${mais}`);
      else if (mais && it.cat === 'item' && !['implement', 'weapon'].includes(it.ref?.cat)) avisos.push(`${it.nome} +${mais}: bônus não encontrados nas regras; confira o texto do item`);
    }
  }
  if (corpo) {
    const f = corpo; const orig = f.nome;
    sint('Armor Class', '+' + f.bonus, 'Armor', 'Armadura: ' + orig);
    if (f.check) sint('Armor Penalty', '' + f.check, '', 'Armadura: ' + orig);
    if (f.velocidade) sint('Speed', '' + f.velocidade, '', 'Armadura: ' + orig);
    vestindo.add('armor:' + f.tipo); vestindo.add(['cloth', 'leather', 'hide'].includes(f.tipo) ? 'armor:light' : 'armor:heavy'); vestindo.add('slot:body');
    const nomeProf = { cloth: 'Cloth', leather: 'Leather', hide: 'Hide', chain: 'Chainmail', scale: 'Scale', plate: 'Plate' }[f.tipo];
    if (nomeProf && !tags.has(norma(`Armor Proficiency (${nomeProf})`))) avisos.push(`Sem proficiência com armadura ${nomeProf.toLowerCase()} (${orig}): o bônus entra, mas você sofre penalidades nos ataques`);
  } else vestindo.add('armor:');
  if (escudo) {
    const leve = escudo.tipo === 'light';
    const prof = tags.has(norma(`Shield Proficiency (${leve ? 'Light' : 'Heavy'})`));
    if (prof) { sint('Armor Class', '+' + escudo.bonus, 'Shield', 'Escudo: ' + escudo.nome); sint('Reflex Defense', '+' + escudo.bonus, 'Shield', 'Escudo: ' + escudo.nome); }
    else avisos.push(`Sem proficiência com escudo ${leve ? 'leve' : 'pesado'} (${escudo.nome}): o bônus de escudo NÃO foi somado`);
    if (escudo.check) sint('Armor Penalty', '' + escudo.check, 'Shield', 'Escudo: ' + escudo.nome);
    vestindo.add('armor:shield'); vestindo.add('slot:off hand');
  }

  // ajustes manuais (também guardam a diferença de fichas importadas que o app não soube explicar)
  const AJ = { ca: 'ac', fort: 'fortitude defense', ref: 'reflex defense', vont: 'will defense', pv: 'hit points', surtos: 'healing surges', ini: 'initiative', vel: 'speed' };
  for (const [k, stat] of Object.entries(AJ)) if (+P.ajustes?.[k]) sint(stat, (P.ajustes[k] > 0 ? '+' : '') + P.ajustes[k], '', 'Ajuste manual');

  // ---------- avaliação
  const baixo = (s) => String(s).toLowerCase();
  const porStat = new Map();
  const chaveStat = (s) => { const k = baixo(s).trim(); return k === 'armor class' ? 'ac' : k; };
  for (const q of stats) { const k = chaveStat(q.stat); if (!porStat.has(k)) porStat.set(k, []); porStat.get(k).push(q); }

  const reqOk = (req) => {
    if (!req) return true;
    return String(req).split('|').some((alt) => alt.split(/[&,]/).every((t0) => {
      let t = t0.trim(); if (!t) return true;
      let neg = false; if (t[0] === '!') { neg = true; t = t.slice(1).trim(); }
      let ok;
      const m = /^(\d+) level$/i.exec(t);
      if (m) ok = nivel >= +m[1]; else ok = tags.has(norma(t));
      return neg ? !ok : ok;
    }));
  };
  const wearOk = (w) => !w || String(w).split(/[|,]/).some((t) => vestindo.has(baixo(t.trim())));
  const origens = {};
  const memo = new Map(); const emCurso = new Set();
  const val = (nome, detalhe) => {
    const k = chaveStat(nome);
    if (k === 'half-level') return Math.floor(nivel / 2);
    if (k === 'level' && !porStat.has('level')) return nivel;
    let m = /^abilitymod\((\w+)\)$/.exec(k);
    if (m) return mod(val(ATR_EN[EN_ATR[m[1]]] || m[1]));
    m = /^(\w+) modifier$/.exec(k);
    if (m && EN_ATR[m[1]]) return mod(val(ATR_EN[EN_ATR[m[1]]]));
    for (const [pt, en] of Object.entries(ATR_EN)) if (k === en) { const base = atr[pt]; return base + sumStat(k, detalhe, true); }
    if (k === 'armor class') return val('ac', detalhe);
    if (!detalhe && memo.has(k)) return memo.get(k);
    if (emCurso.has(k)) return 0;
    emCurso.add(k);
    const r = sumStat(k, detalhe, false);
    emCurso.delete(k);
    if (!detalhe) memo.set(k, r);
    return r;
  };
  function sumStat(k, detalhe, soExtras) {
    const lista = porStat.get(k) || [];
    const tipados = new Map(); let soma = 0; const linhas = [];
    for (const q of lista) {
      if (!reqOk(q.req) || !wearOk(q.wear)) continue;
      if (q.nwear && wearOk(q.nwear)) continue;
      const v = avaliaExpr(q.expr, (n) => val(n));
      if (!v) continue;
      const tp = q.tipo && q.tipo !== q.fonte ? q.tipo : '';
      if (tp && v > 0) { const at = tipados.get(tp); if (!at || v > at.v) tipados.set(tp, { v, q }); linhas.push({ q, v, tp, aplicado: null }); }
      else { soma += v; linhas.push({ q, v, tp, aplicado: true }); }
    }
    let total = soma;
    for (const { v } of tipados.values()) total += v;
    if (detalhe) {
      for (const l of linhas) if (l.aplicado === null) l.aplicado = tipados.get(l.tp)?.q === l.q;
      detalhe.push(...linhas.map((l) => ({ fonte: l.q.fonte, valor: l.v, tipo: l.tp, aplicado: l.aplicado })));
    }
    return total;
  }
  const explica = (stat) => { const d = []; val(stat, d); return d.filter((x) => x.valor && x.fonte !== 'Regras base' || (x.valor && ['ac', 'Initiative'].includes(stat))).filter((x) => x.fonte !== 'Regras base'); };
  const total = (stat) => val(stat);

  // atributos finais (inclui bônus de itens/talentos que mexem no atributo)
  const final = {}, mods = {};
  for (const k of ATR) { final[k] = atr[k] + sumStat(ATR_EN[k], null, true); mods[k] = mod(final[k]); }
  // as fórmulas usam val('strength'…) = atr + extras → coerente com 'final'

  const ac = total('ac'), fort = total('fortitude defense'), ref = total('reflex defense'), vont = total('will defense');
  const pv = total('hit points');
  const surtos = total('healing surges');
  const valorSurto = Math.floor(pv / 4) + total('healing surge value');
  const velocidade = Math.max(0, total('speed'));
  const iniciativa = total('initiative');
  const penal = total('armor penalty');
  const pericias = {};
  for (const [nome, ab] of PERICIAS) {
    const tr = !!P.pericias?.[nome]?.treinada;
    const extra = +P.pericias?.[nome]?.extra || 0;
    pericias[nome] = mod(final[ab]) + Math.floor(nivel / 2) + (tr ? 5 : 0) + total(norma(nome) + ' misc') + (PENALIZA.has(nome) ? penal : 0) + extra;
  }
  // ataques das armas equipadas
  const atq = [];
  for (const { it, w } of ataques) {
    const mais = it.ench?.mais || 0;
    const ab = w.distancia ? 'des' : 'for';
    const alt = w.distancia ? null : ('des');
    const bonusAtq = Math.floor(nivel / 2) + w.prof + mais + total('attack rolls');
    atq.push({ nome: it.nome, dano: w.dano, grupo: w.grupo, distancia: w.distancia, mais, ataque: bonusAtq + mods[ab], danoBonus: mods[ab] + mais + total('damage rolls'), atributo: ab, prof: w.prof, extraAtq: total('attack rolls'), extraDano: total('damage rolls'), alternativo: alt && { atributo: alt, ataque: bonusAtq + mods[alt] } });
  }
  const gastos = (P.itens || []).reduce((a, i) => a + (+i.custo || 0), 0);
  // Detalhe de um bônus (ex.: 'attack rolls', 'damage rolls') como se só as armas dos grupos dados estivessem em uso: usado pelo cálculo por poder
  const detalheStat = (stat, grupos = []) => {
    const salvo = [...vestindo].filter((t) => t.startsWith('weapon:'));
    for (const t of salvo) vestindo.delete(t);
    for (const g of grupos) vestindo.add('weapon:' + baixo(g));
    memo.clear();
    const linhas = []; const total = val(stat, linhas);
    for (const t of [...vestindo].filter((x) => x.startsWith('weapon:'))) vestindo.delete(t);
    for (const t of salvo) vestindo.add(t);
    memo.clear();
    return { total, linhas: linhas.filter((l) => l.valor && l.fonte !== 'Regras base') };
  };
  const resultado = {
    nivel, atributos: final, modificadores: mods, detalheAtributos: detAtr,
    ac, fort, ref, vont, pv, surtos, valorSurto, velocidade, iniciativa, penalidadeArmadura: penal, pericias,
    ataques: atq, avisos, gastos, passivas,
    origem: { ac: explica('ac'), fort: explica('fortitude defense'), ref: explica('reflex defense'), vont: explica('will defense'), pv: explica('hit points'), velocidade: explica('speed'), iniciativa: explica('initiative') },
    tags: tags.size,
  };
  Object.defineProperty(resultado, 'detalheStat', { value: detalheStat, enumerable: false });
  return resultado;
}
