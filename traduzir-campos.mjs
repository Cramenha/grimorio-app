// Traduz os campos de criatura (tipo, equipamento, alvo, gatilho…) que o dicionário de trechos não cobre, para compendio\pt-campos.json.
// Roda uma vez (quem mantém). Uso: node traduzir-campos.mjs [--modelo sonnet] [--paralelo 4] [--contar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as cri from './criatura.mjs';
import * as comp from './compendio.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARQ = path.join(aqui, 'compendio', 'pt-campos.json');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELOS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const modelo = MODELOS[arg('modelo', 'sonnet')];
const paralelo = +arg('paralelo', 4);
const mapa = fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, 'utf8')) : {};

const CAMPOS_C = ['tipoTexto', 'sentidos', 'resistencias', 'vulnerabilidades', 'imunidades', 'pericias', 'idiomas', 'equipamento', 'descricao', 'tendencia'];
const CAMPOS_P = ['palavras', 'alvo', 'acerto', 'erro', 'efeito', 'especial', 'requisito', 'gatilho'];
const pend = new Map();
const lista = comp.carregar('monster').linhas;
for (const l of lista) {
  let a, b;
  try { a = cri.monstroDoCompendio(l.ID, false); b = cri.monstroDoCompendio(l.ID, true); } catch { continue; }
  const ver = (x, y) => { if (x && /[A-Za-z]{3}/.test(x) && x === y && !mapa[x]) pend.set(x, (pend.get(x) || 0) + 1); };
  for (const k of CAMPOS_C) ver(a[k], b[k]);
  a.poderes.forEach((p, i) => { for (const k of CAMPOS_P) ver(p[k], b.poderes[i][k]); });
}
const itens = [...pend.keys()];
console.log(`${itens.length} valores distintos sem tradução (${[...pend.values()].reduce((s, n) => s + n, 0)} usos).`);
if (process.argv.includes('--contar') || !itens.length) process.exit(0);

const SISTEMA = `Você traduz textos de fichas de monstros de D&D 4ª edição (inglês -> português do Brasil, estilo dos livros oficiais).
Recebe linhas "N<TAB>texto" e responde SOMENTE "N<TAB>tradução", uma por linha, mesma numeração. Mantenha números, dados, sinais (+, -), símbolos e pontuação; traduza o resto.
GLOSSÁRIO: bloodied = sangrando; healing surge = pulso de cura; slide = conduzir; shift = ajustar; area burst = explosão de área; close burst N = explosão contígua N; close blast N = rajada contígua N; at-will = sem limite; encounter = encontro; extended rest = descanso longo; short rest = descanso curto; dazed = pasmo; stunned = atordoado; prone = derrubado (nunca caído); immobilized = imobilizado; slowed = lento; restrained = contido; marked = marcado; save ends = teste de resistência encerra; opportunity attack = ataque de oportunidade; standard action = ação padrão; move action = ação de movimento; minor action = ação menor; free action = ação livre; immediate reaction/interrupt = reação/interrupção imediata; saving throw = teste de resistência; AC = CA; Fortitude = Fortitude; Reflex = Reflexos; Will = Vontade; ongoing N damage = dano contínuo de N; resist = resistência; vulnerable = vulnerabilidade.
Em alcances com criatura, a criatura vem na frente (melee spirit 1 = espírito corpo a corpo 1). Tipos como "natural beast" = "fera natural"; "(undead)" = "(morto-vivo)"; equipamentos em lista (leather armor, spear...) traduza item a item em minúsculas. Não explique nada.`;

const esc = (t) => t.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
const lotes = []; let at = null;
for (const t of itens) { if (!at || at.chars + t.length + 10 > 7000) { at = { chars: 0, itens: [] }; lotes.push(at); } at.itens.push(t); at.chars += t.length + 10; }
let feitos = 0; let sujo = false;
const gravar = () => { if (!sujo) return; fs.writeFileSync(ARQ + '.tmp', JSON.stringify(mapa)); for (let i = 0; i < 20; i++) { try { fs.renameSync(ARQ + '.tmp', ARQ); break; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500); } } sujo = false; };
const nums = (s) => (String(s).match(/\d+(?:d\d+)?/g) || []).join(',');
async function lote(l, tent = 0) {
  const prompt = l.itens.map((t, i) => `${i + 1}\t${esc(t)}`).join('\n');
  let texto = '';
  const s = query({ prompt, options: { systemPrompt: SISTEMA, tools: [], allowedTools: [], settingSources: [], maxTurns: 1, model: modelo } });
  for await (const m of s) if (m.type === 'result') { if (m.subtype !== 'success') throw new Error(m.subtype); texto = m.result; }
  let ok = 0;
  for (const ln of texto.split('\n')) {
    const m = /^(\d+)\t(.*)$/.exec(ln.replace(/\r$/, '')); if (!m) continue;
    const k = l.itens[+m[1] - 1]; if (k === undefined || !m[2].trim()) continue;
    if (nums(k) !== nums(m[2])) continue; // alinhamento: os números têm que bater
    mapa[k] = m[2].trim(); ok++; sujo = true;
  }
  if (ok < l.itens.length * 0.9 && tent < 2) return lote({ itens: l.itens.filter((t) => !mapa[t]) }, tent + 1);
  return ok;
}
const t0 = Date.now(); const fila = [...lotes];
await Promise.all(Array.from({ length: paralelo }, async () => {
  while (fila.length) { const l = fila.shift(); try { feitos += await lote(l); } catch (e) { console.log('  erro:', e.message); } gravar(); console.log(`${feitos} valores · ${((Date.now() - t0) / 60000).toFixed(1)} min · restam ${fila.length} lotes`); }
}));
gravar();
console.log('Concluído.', Object.keys(mapa).length, 'valores em pt-campos.json');
