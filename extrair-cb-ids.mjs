// Monta compendio\cb-ids.json: "Tipo|nome em minúsculas" -> internal-id do Character Builder,
// a partir de regras.json (peças do CBLoader) e das fichas .dnd4e de exemplo. Usado pela exportação .dnd4e.
// Uso: node extrair-cb-ids.mjs [pasta-com-dnd4e ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const saida = path.join(aqui, 'compendio', 'cb-ids.json');
const ids = fs.existsSync(saida) ? JSON.parse(fs.readFileSync(saida, 'utf8')) : {};
const ent = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const regras = JSON.parse(fs.readFileSync(path.join(aqui, 'compendio', 'regras.json'), 'utf8'));
for (const [k, v] of Object.entries(regras.nome || {})) ids[k] = v;

const pastas = process.argv.slice(2);
if (!pastas.length) pastas.push('C:\\CharacterBuilder\\SampleChars', `${process.env.USERPROFILE}\\Documents\\ddi\\Saved Characters`);
const acha = (p) => fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? acha(path.join(p, e.name)) : e.name.endsWith('.dnd4e') ? [path.join(p, e.name)] : []);
let arqs = 0;
for (const p of pastas) {
  if (!fs.existsSync(p)) continue;
  for (const f of acha(p)) {
    arqs++;
    const x = fs.readFileSync(f, 'utf8');
    for (const m of x.matchAll(/<RulesElement name="([^"]*)" type="([^"]*)" internal-id="([^"]*)"/g)) ids[`${m[2]}|${ent(m[1]).toLowerCase()}`] = m[3];
  }
}
fs.writeFileSync(saida, JSON.stringify(ids));
console.log(`${Object.keys(ids).length} ids (${arqs} fichas lidas) -> ${saida}`);
