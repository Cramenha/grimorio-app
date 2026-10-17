// Ida e volta: .dnd4e de exemplo -> ficha do app -> .dnd4e exportado -> ficha do app. Compara o que importa.
// Uso: node teste-export-dnd4e.mjs [pasta]
import fs from 'node:fs';
import path from 'node:path';
import { lerDnd4e } from './importar.mjs';
import { exportarDnd4e } from './dnd4e-export.mjs';
import { calcular } from './calculo.mjs';

const pasta = process.argv[2] || 'C:\\CharacterBuilder\\SampleChars\\SampleHeroes';
let falhas = 0;
for (const f of fs.readdirSync(pasta).filter((n) => n.endsWith('.dnd4e'))) {
  const orig = fs.readFileSync(path.join(pasta, f), 'utf8');
  const A = lerDnd4e(orig);
  const { xml, avisos } = exportarDnd4e(A);
  let B;
  try { B = lerDnd4e(xml); } catch (e) { console.log(f, 'ERRO ao reler:', e.message); falhas++; continue; }
  const cA = calcular(A), cB = calcular(B);
  const dif = [];
  const cmp = (k, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) dif.push(`${k}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  cmp('nome', A.nome, B.nome); cmp('nivel', A.nivel, B.nivel);
  for (const c of ['raca', 'classe', 'paragon', 'destino', 'tema', 'antecedente', 'divindade']) cmp(c, A[c]?.nome ?? null, B[c]?.nome ?? null);
  cmp('talentos', A.talentos.map((t) => t.nome).sort(), B.talentos.map((t) => t.nome).sort());
  cmp('poderes', A.poderes.map((t) => t.nome).sort(), B.poderes.map((t) => t.nome).sort());
  cmp('itens', A.itens.map((t) => t.nome + t.equipado).sort(), B.itens.map((t) => t.nome + t.equipado).sort());
  cmp('atributos', A.atributos, B.atributos);
  cmp('treinadas', Object.entries(A.pericias).filter(([, v]) => v.treinada).map(([k]) => k), Object.entries(B.pericias).filter(([, v]) => v.treinada).map(([k]) => k));
  cmp('xp', A.xp, B.xp);
  cmp('CA/PV (calculado)', [cA.ac, cA.pv, cA.fort, cA.ref, cA.vont], [cB.ac, cB.pv, cB.fort, cB.ref, cB.vont]);
  cmp('notas', A.notas.length, B.notas.length);
  console.log(`${f}: ${dif.length ? 'DIFERENÇAS' : 'ok'} | ${xml.length} bytes | avisos ${avisos.length}`);
  dif.forEach((d) => console.log('   ', d));
  avisos.slice(0, 4).forEach((a) => console.log('    aviso:', a));
  if (dif.length) falhas++;
}
process.exit(falhas ? 1 : 0);
