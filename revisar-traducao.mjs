// Segunda passada: um revisor (Claude) confere, com o inglês ao lado, as traduções que contêm termos do glossário
// e devolve só as correções. Retomável (revisados.json). Uso: node revisar-traducao.mjs [--modelo sonnet] [--paralelo 4] [--limite N]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARQ = path.join(aqui, 'compendio', 'pt.json');
const LOG = path.join(aqui, 'compendio', 'revisados.json');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELOS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const modelo = MODELOS[arg('modelo', 'sonnet')];
const paralelo = +arg('paralelo', 4);
const limite = +arg('limite', 0);

const dic = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const feitos = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};
let sujo = false;
const gravar = () => {
  if (!sujo) return;
  fs.writeFileSync(ARQ + '.tmp', JSON.stringify(dic));
  for (let i = 0; i < 20; i++) { try { fs.renameSync(ARQ + '.tmp', ARQ); break; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500); } }
  fs.writeFileSync(LOG, JSON.stringify(feitos));
  sujo = false;
};

const TERMOS = /\bbloodied\b|\bbloody\b|healing surge|\bslid(e|es|ing)\b|\bshift(s|ed|ing)?\b|area (burst|wall)|close (burst|blast)|at-will|\bencounter\b|paragon path|extended rest|short rest|\bprone\b|\bmelee (spirit|beast|animal)|\b(spirit|beast|animal) \d/i;
const TODOS = process.argv.includes('--todos');
const lista = Object.keys(dic).filter((k) => !feitos[k] && (TODOS ? k.length > 24 && /[a-z]{3,} [a-z]{3,}/i.test(k) : TERMOS.test(k) && k.length > 4));
console.log(`A revisar: ${lista.length} trechos. Modelo ${modelo}, paralelo ${paralelo}.`);
if (!lista.length) process.exit(0);

const SISTEMA = `Você é revisor de traduções de D&D 4ª edição (inglês -> português do Brasil, estilo dos livros oficiais).
Você recebe blocos "N<TAB>ORIGINAL<TAB>TRADUÇÃO". Confira cada tradução com o contexto e responda SOMENTE com uma linha por item:
- "N<TAB>OK" se a tradução está correta, completa, no sentido certo e usa o glossário;
- "N<TAB>texto corrigido" (só a tradução corrigida, mesmo formato, mesmos números, dados, símbolos e entidades HTML) se houver erro.
GLOSSÁRIO OBRIGATÓRIO: bloodied = sangrando (invariável: "o alvo está sangrando", "quando ficar sangrando"; nomes de poderes também "Sangrando"); healing surge = pulso de cura; slide (movimento forçado) = conduzir ("você conduz o alvo 2 quadrados"; "condução"); shift (movimento voluntário de quadrados) = ajustar ("você pode ajustar 1 quadrado"); area burst = explosão de área; area wall = muralha de área; close burst N = explosão contígua N; close blast N = rajada contígua N; at-will = sem limite; encounter (rótulo de uso) = encontro; paragon path = trilha exemplar (feminino); extended rest = descanso longo; short rest = descanso curto; dazed = pasmo; stunned = atordoado; prone = derrubado (NUNCA "caído", que em D&D é outra coisa); knock prone / knocked prone = derrubar / derrubado; falls prone = fica derrubado ("derrubar" é o verbo, "derrubado" o estado).
Atenção: ORDEM em alcances com criatura: "melee spirit 1" = "espírito corpo a corpo 1"; "melee beast 1" = "fera corpo a corpo 1". Não confunda burst (explosão) com blast (rajada). "slide/shift/slid" em sentido comum (algo desliza, a luz muda) NÃO usa conduzir/ajustar: traduza naturalmente. Corrija também traduções que mudaram o sentido, omitiram ou sobraram partes em inglês. Não explique nada. Uma linha por item, mesma numeração.`;

const esc = (t) => t.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
const nums = (s) => (String(s).match(/\d+(?:d\d+)?/g) || []).sort().join(',');
const lotes = [];
let at = null;
for (const k of lista) {
  const tam = k.length + dic[k].length + 12;
  if (!at || at.chars + tam > +arg('tam', 9000)) { at = { chars: 0, itens: [] }; lotes.push(at); }
  at.itens.push(k); at.chars += tam;
}
const corte = limite ? lotes.slice(0, limite) : lotes;
console.log(`${corte.length} lotes.`);
let mudou = 0, feitosN = 0, recusados = 0;
const t0 = Date.now();

async function revisa(lote, tentativa = 0) {
  const prompt = lote.itens.map((k, i) => `${i + 1}\t${esc(k)}\t${esc(dic[k])}`).join('\n');
  let texto = '';
  const s = query({ prompt, options: { systemPrompt: SISTEMA, tools: [], allowedTools: [], settingSources: [], maxTurns: 1, model: modelo } });
  for await (const msg of s) { if (msg.type === 'result') { if (msg.subtype !== 'success') throw new Error('claude: ' + msg.subtype); texto = msg.result; } }
  let ok = 0;
  for (const l of texto.split('\n')) {
    const m = /^(\d+)\t(.*)$/.exec(l.replace(/\r$/, ''));
    if (!m) continue;
    const k = lote.itens[+m[1] - 1];
    if (k === undefined) continue;
    ok++; feitos[k] = 1; sujo = true;
    const r = m[2].trim();
    if (!r || /^OK\.?$/i.test(r)) continue;
    if (nums(k) !== nums(r) && nums(k) === nums(dic[k])) { recusados++; continue; } // a correção mexeu nos números
    if (r.length < dic[k].length * 0.5 || r.length > dic[k].length * 2) { recusados++; continue; }
    if (r !== dic[k]) { dic[k] = r; mudou++; }
  }
  if (ok < lote.itens.length * 0.9 && tentativa < 2) return revisa({ itens: lote.itens.filter((k) => !feitos[k]) }, tentativa + 1);
  return ok;
}
const trabalhador = async () => {
  while (corte.length) {
    const lote = corte.shift();
    try { feitosN += await revisa(lote); } catch (e) { console.log('  erro no lote:', e.message); }
    gravar();
    console.log(`revisados ${feitosN} · corrigidos ${mudou} · recusados ${recusados} · ${((Date.now() - t0) / 60000).toFixed(1)} min · restam ${corte.length} lotes`);
  }
};
await Promise.all(Array.from({ length: paralelo }, trabalhador));
gravar();
console.log('Concluído.', { revisados: feitosN, corrigidos: mudou, recusados });
