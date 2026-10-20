// Extrai dos arquivos de regras do Character Builder (CBLoader, *.part) só o que o cálculo da ficha usa:
// bônus (statadd) com requisitos, e as concessões (grant) de cada elemento. Gera compendio\regras.json.
// Só quem distribui o app precisa rodar isto (precisa da pasta do CB); os amigos recebem o arquivo pronto.
// Uso: node extrair-regras.mjs [pasta-com-os-.part ...] (padrão: as partes 00-41 do CBLoader em Documentos + a pasta Custom do CBLoader em AppData, nessa ordem)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm } from './compendio.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirs = process.argv.length > 2 ? process.argv.slice(2) : [`${process.env.USERPROFILE}/Documents/ddi/CBLoader`, `${process.env.APPDATA}/CBLoader/Custom`];
const ent = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const RELEVANTE = [
  /^(AC|Armor Class)$/i, /Defense/i, /^Speed$/i, /^Initiative( Misc)?$/i, /^Healing Surges?$/i, /^Healing Surge Value$/i, /^Hit Points$/i,
  /^_LEVEL-ONE-HPS$/i, /^_PER-LEVEL-HPS$/i, /^(Strength|Constitution|Dexterity|Intelligence|Wisdom|Charisma)$/i, / Misc$/i, /^Armor Penalty$/i,
  /^Saving Throws$/i, /^Armor Enhancement Bonus$/i, /^Level$/i, /^(attack rolls|damage rolls)$/i,
];
const relevante = (n) => RELEVANTE.some((r) => r.test(n));
const TIPOS_NOME = new Set(['Race', 'Class', 'Feat', 'Theme', 'Background', 'Paragon Path', 'Epic Destiny', 'Magic Item', 'Racial Trait', 'Class Feature', 'Deity', 'Hybrid Class', 'Build']);

const arqs = dirs.flatMap((d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.part')).sort().map((f) => path.join(d, f)) : []);
const el = {};   // id -> elemento
let lidos = 0;
for (const a of arqs) {
  const x = fs.readFileSync(a, 'utf8');
  for (const m of x.matchAll(/<RulesElement name="([^"]*)" type="([^"]*)" internal-id="([^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/RulesElement>)/g)) {
    lidos++;
    const corpo = m[4] || '';
    const r = /<rules>([\s\S]*?)<\/rules>/.exec(corpo);
    if (!r) continue;
    const s = [], g = [];
    for (const t of r[1].matchAll(/<statadd\b([^>]*?)\/?>/g)) {
      const at = {};
      for (const k of t[1].matchAll(/([\w-]+)="([^"]*)"/g)) at[k[1]] = ent(k[2]);
      if (!at.name || at.value === undefined) continue;
      if (at.zero !== undefined || at['non-zero'] !== undefined || at['half-point'] !== undefined || at.condition !== undefined) continue; // situacionais
      s.push({ n: at.name, v: at.value, t: at.type || '', r: at.requires || '', w: at.wearing || '', nw: at['not-wearing'] || '' });
    }
    for (const t of r[1].matchAll(/<grant\b([^>]*?)\/?>/g)) {
      const at = {};
      for (const k of t[1].matchAll(/([\w-]+)="([^"]*)"/g)) at[k[1]] = ent(k[2]);
      if (at.name) g.push([at.name, at.requires || '']);
    }
    // só mantém statadds relevantes ou variáveis usadas por elas
    const manter = new Set();
    s.forEach((q, i) => { if (relevante(q.n)) manter.add(i); });
    let mudou = true;
    while (mudou) {
      mudou = false;
      const usados = new Set([...manter].map((i) => s[i].v.replace(/^[+-]/, '')));
      s.forEach((q, i) => { if (!manter.has(i) && usados.has(q.n)) { manter.add(i); mudou = true; } });
    }
    const sf = s.filter((_, i) => manter.has(i));
    if (!sf.length && !g.length) continue;
    // se o mesmo id aparece em vários arquivos, o último vence (como no CBLoader)
    el[m[3]] = { n: ent(m[1]), t: m[2], s: sf, g };
  }
}

// poda: elementos sem bônus e cujas concessões não levam a nada
const mantido = new Map();
const util = (id, vis = new Set()) => {
  if (mantido.has(id)) return mantido.get(id);
  const e = el[id];
  if (!e || vis.has(id)) return false;
  vis.add(id);
  const r = e.s.length > 0 || e.g.some(([gid]) => util(gid, vis));
  mantido.set(id, r);
  return r;
};
const saida = { v: 1, el: {}, nome: {} };
for (const id of Object.keys(el)) {
  if (!util(id)) continue;
  const e = el[id];
  saida.el[id] = { n: e.n, t: e.t, s: e.s.map((q) => [q.n, q.v, q.t, q.r, q.w, q.nw]), g: e.g.filter(([gid]) => mantido.get(gid)) };
  if (TIPOS_NOME.has(e.t)) saida.nome[e.t + '|' + norm(e.n)] = id;
}
fs.writeFileSync(path.join(aqui, 'compendio', 'regras.json'), JSON.stringify(saida));
const tam = fs.statSync(path.join(aqui, 'compendio', 'regras.json')).size;
console.log(`lidos ${lidos} elementos; mantidos ${Object.keys(saida.el).length}; nomes ${Object.keys(saida.nome).length}; ${(tam / 1e6).toFixed(2)} MB`);
const porTipo = {}; Object.values(saida.el).forEach((e) => { porTipo[e.t] = (porTipo[e.t] || 0) + 1; });
console.log(porTipo);
