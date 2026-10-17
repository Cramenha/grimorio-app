// Confere o dicionário de tradução: acha trechos suspeitos (números diferentes, tamanho muito diferente) e,
// com --apagar, remove-os de pt.json para que `node traduzir-tudo.mjs` os traduza de novo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARQ = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compendio', 'pt.json');
const d = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const nums = (s) => (String(s).match(/\d+(?:d\d+)?/g) || []).sort().join(',');
const ruins = [];
for (const [en, pt] of Object.entries(d)) {
  let motivo = '';
  if (nums(en) !== nums(pt)) motivo = 'números diferentes';
  else if (en.length > 12 && (pt.length < en.length * 0.35 || pt.length > en.length * 3)) motivo = 'tamanho';
  else if (en.length > 40 && (pt.length < en.length * 0.6 || pt.length > en.length * 2)) motivo = 'tamanho (rígido)';
  else if (en.length > 40 && pt === en && / (the|you|your|and|to|of|a) /i.test(en)) motivo = 'sem tradução';
  else if (pt.includes('\t')) motivo = 'tabulação';
  if (motivo) ruins.push([en, pt, motivo]);
}
console.log(`${Object.keys(d).length} trechos; suspeitos: ${ruins.length}`);
for (const [en, pt, m] of ruins.slice(0, 15)) console.log(`[${m}]`, JSON.stringify(en.slice(0, 80)), '=>', JSON.stringify(pt.slice(0, 80)));
if (process.argv.includes('--apagar')) {
  for (const [en] of ruins) delete d[en];
  fs.writeFileSync(ARQ + '.tmp', JSON.stringify(d)); fs.renameSync(ARQ + '.tmp', ARQ);
  console.log('Removidos; rode node traduzir-tudo.mjs para refazer.');
}
