// Segunda passada só com NOMES (poderes, talentos, itens…), cada um isolado e com contexto (tipo, classe, nível).
// Garante que o nome mostrado em "Original (Tradução)" é o certo mesmo se o lote grande tiver desalinhado algum.
// Uso: node traduzir-nomes.mjs [--modelo haiku|sonnet] [--paralelo 4] [--cats power,feat]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { GLOSSARIO_PADRAO } from './traduzir.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARQ = path.join(aqui, 'compendio', 'pt.json');
const FEITOS = path.join(aqui, 'compendio', 'pt-nomes-ok.json'); // nomes já conferidos nesta passada
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELOS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5' };
const modelo = MODELOS[arg('modelo', 'haiku')];
const paralelo = +arg('paralelo', 4);
const CATS = arg('cats', 'power,feat,class,race,theme,background,paragonpath,epicdestiny,deity,armor,weapon,implement,item,ritual,companion,disease,poison,trap,monster').split(',');

const dic = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const feitos = fs.existsSync(FEITOS) ? JSON.parse(fs.readFileSync(FEITOS, 'utf8')) : {};
const itens = [];
const vistos = new Set();
for (const cat of CATS) {
  const f = path.join(aqui, 'compendio', cat + '.json');
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const l of j.linhas) {
    const nome = String(l[1]);
    if (feitos[nome] || vistos.has(nome)) continue;
    vistos.add(nome);
    const ctx = l.slice(2, 5).map((x) => (Array.isArray(x) ? x[0] : x)).filter((x) => x !== '' && x !== undefined).join(' / ');
    itens.push({ cat, nome, ctx });
  }
}
console.log(itens.length, 'nomes a conferir');

const SISTEMA = `Você traduz NOMES de elementos de Dungeons & Dragons 4ª edição (poderes, talentos, itens, classes, raças, caminhos…) do inglês para o português do Brasil, no estilo dos livros oficiais em português (Galápagos).
Entrada: linhas "N<TAB>nome<TAB>tipo: contexto". Saída: SOMENTE linhas "N<TAB>tradução", mesma numeração.
Regras: tradução natural, curta, que soe como nome em livro (ex.: Magic Missile = Mísseis Mágicos; Twin Strike = Golpe Duplo). Nomes próprios de pessoas, lugares, deuses e marcas ficam iguais. Se o nome já for uma palavra de origem estrangeira sem tradução natural (ex.: Shillelagh), mantenha. Mantenha números, "+1", símbolos e parênteses como estão (traduza o que há dentro dos parênteses).
Glossário: ${GLOSSARIO_PADRAO.map((g) => `${g.en}=${g.pt}`).join('; ')}.`;

const lotes = [];
for (let i = 0; i < itens.length; i += 140) lotes.push(itens.slice(i, i + 140));
let feitosN = 0, mudados = 0;
async function lote(lista, tentativa = 0) {
  const linhas = lista.map((e, i) => `${i + 1}\t${e.nome.replace(/\t/g, ' ')}\t${e.cat}${e.ctx ? ': ' + e.ctx : ''}`);
  let texto = '';
  const s = query({ prompt: linhas.join('\n'), options: { systemPrompt: SISTEMA, tools: [], allowedTools: [], settingSources: [], maxTurns: 1, model: modelo } });
  for await (const msg of s) { if (msg.type === 'result') { if (msg.subtype !== 'success') throw new Error(msg.subtype); texto = msg.result; } }
  let ok = 0;
  for (const l of texto.split('\n')) {
    const m = /^(\d+)\t(.+)$/.exec(l.replace(/\r$/, ''));
    if (!m) continue;
    const e = lista[+m[1] - 1]; if (!e) continue;
    const pt = m[2].trim();
    if (dic[e.nome] !== pt) { dic[e.nome] = pt; mudados++; }
    feitos[e.nome] = 1; ok++;
  }
  if (ok < lista.length * 0.9 && tentativa < 2) return lote(lista.filter((e) => !feitos[e.nome]), tentativa + 1);
}
const t0 = Date.now();
const fila = [...lotes];
const trab = async () => {
  while (fila.length) {
    const l = fila.shift();
    try { await lote(l); } catch (e) { console.log('erro:', e.message); }
    feitosN++;
    // grava junto com o dicionário atual do disco (o outro processo pode ter escrito novos trechos)
    const atual = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
    for (const e of l) if (feitos[e.nome] && dic[e.nome]) atual[e.nome] = dic[e.nome];
    fs.writeFileSync(ARQ + '.tmp2', JSON.stringify(atual)); fs.renameSync(ARQ + '.tmp2', ARQ);
    fs.writeFileSync(FEITOS, JSON.stringify(feitos));
    console.log(`lote ${feitosN}/${lotes.length} · ${mudados} nomes corrigidos · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
};
await Promise.all(Array.from({ length: paralelo }, trab));
console.log('Concluído.');
