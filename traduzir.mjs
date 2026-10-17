// Tradução de poderes/itens com o Claude (plano do próprio usuário, via Agent SDK), com glossário e cache em disco.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dados');
const ARQ_CACHE = path.join(PASTA, 'traducoes.json');
const ARQ_GLOSSARIO = path.join(PASTA, 'glossario.json');
fs.mkdirSync(PASTA, { recursive: true });

export const MODELOS = {
  padrao: { nome: 'Padrão do plano', id: null },
  haiku: { nome: 'Haiku 5.5 (mais rápido)', id: 'claude-haiku-5-5' },
  sonnet: { nome: 'Sonnet 5.5 (equilibrado)', id: 'claude-sonnet-5-5' },
  opus: { nome: 'Opus 5.5 (mais caprichado)', id: 'claude-opus-5-5' },
};

// "obrigatorio" = pedido explícito do usuário; os demais são o vocabulário usual do 4e em português.
export const GLOSSARIO_PADRAO = [
  { en: 'Dazed', pt: 'Pasmo', obrigatorio: true },
  { en: 'Stunned', pt: 'Atordoado', obrigatorio: true },
  { en: 'Close blast', pt: 'Rajada contígua', obrigatorio: true },
  { en: 'Close burst', pt: 'Explosão contígua', obrigatorio: true },
  { en: 'Area burst', pt: 'Explosão de área', obrigatorio: true },
  { en: 'Bloodied', pt: 'Sangrando', obrigatorio: true },
  { en: 'Slide (forçar movimento)', pt: 'conduzir (você conduz o alvo 2 quadrados; conduzido)', obrigatorio: true },
  { en: 'Shift (movimento)', pt: 'ajustar (você pode ajustar 1 quadrado; ajuste)', obrigatorio: true },
  { en: 'Area wall', pt: 'Muralha de área' },
  { en: 'Prone', pt: 'Derrubado (nunca "caído": em D&D isso é outra coisa; knock prone = derrubar; falls prone = fica derrubado)', obrigatorio: true },
  { en: 'Slowed', pt: 'Lento' },
  { en: 'Immobilized', pt: 'Imobilizado' },
  { en: 'Restrained', pt: 'Contido' },
  { en: 'Weakened', pt: 'Enfraquecido' },
  { en: 'Marked', pt: 'Marcado' },
  { en: 'Blinded', pt: 'Cego' },
  { en: 'Deafened', pt: 'Surdo' },
  { en: 'Dominated', pt: 'Dominado' },
  { en: 'Petrified', pt: 'Petrificado' },
  { en: 'Unconscious', pt: 'Inconsciente' },
  { en: 'Helpless', pt: 'Indefeso' },
  { en: 'Saving throw', pt: 'teste de resistência' },
  { en: 'Healing surge', pt: 'pulso de cura (plural: pulsos de cura)', obrigatorio: true },
  { en: 'Healing surge value', pt: 'valor de pulso de cura' },
  { en: 'At-Will', pt: 'Sem limite', obrigatorio: true },
  { en: 'Paragon path', pt: 'Trilha Exemplar (feminino: a trilha exemplar)', obrigatorio: true },
  { en: 'Extended rest', pt: 'descanso longo', obrigatorio: true },
  { en: 'Short rest', pt: 'descanso curto' },
  { en: 'Per Encounter / Encounter (rótulo de uso)', pt: 'Encontro', obrigatorio: true },
  { en: 'Encounter', pt: 'Encontro' },
  { en: 'Daily', pt: 'Diário' },
];

export function lerGlossario() {
  try { return JSON.parse(fs.readFileSync(ARQ_GLOSSARIO, 'utf8')); } catch { return GLOSSARIO_PADRAO; }
}
export function salvarGlossario(lista) {
  const limpa = (Array.isArray(lista) ? lista : []).map((g) => ({
    en: String(g.en || '').trim(), pt: String(g.pt || '').trim(), obrigatorio: !!g.obrigatorio,
  })).filter((g) => g.en && g.pt);
  fs.writeFileSync(ARQ_GLOSSARIO, JSON.stringify(limpa, null, 1));
  return limpa;
}

let cache = {};
try { cache = JSON.parse(fs.readFileSync(ARQ_CACHE, 'utf8')); } catch { cache = {}; }
let gravando = null;
function gravarCache() {
  clearTimeout(gravando);
  gravando = setTimeout(() => fs.writeFile(ARQ_CACHE, JSON.stringify(cache), () => {}), 400);
}
export const limparTraducoes = () => { cache = {}; gravarCache(); };

const INSTRUCOES = (glos) => `Você traduz textos de regras de Dungeons & Dragons 4ª edição do inglês para o português do Brasil, no estilo dos livros oficiais em português.
Regras:
- Receberá o nome de um poder/item e o HTML da descrição. Traduza o NOME e o TEXTO dentro do HTML.
- Preserve EXATAMENTE todas as tags HTML, atributos e a estrutura. Altere só os textos.
- Traduza também as palavras de regra (Target, Attack, Hit, Miss, Effect, Special, Requirement, Trigger, Standard Action etc.), no vocabulário usual do 4e em português.
- Mantenha como estão: números, dados (2d8+4), siglas de atributos entre parênteses só se não houver equivalente óbvio, símbolos (✦) e nomes próprios de lugares, deuses e personagens.
- Nomes de outros poderes, talentos e itens citados no texto: traduza o termo comum e mantenha o nome original entre parênteses na primeira vez se for um nome de regra específico.
- Palavras-chave de dano (fire, cold, radiant...) viram "fogo", "frio", "radiante"..., e tipos como "Arcane", "Martial", "Weapon", "Implement" também traduzidos ("Arcano", "Marcial", "Arma", "Implemento").
- GLOSSÁRIO (siga sempre, nas formas de singular/plural/gênero que o texto pedir):
${glos.map((g) => `  - ${g.en} = ${g.pt}${g.obrigatorio ? '   (OBRIGATÓRIO)' : ''}`).join('\n')}
- Formato da resposta, sem nenhum comentário extra:
NOME: <nome traduzido; se o nome é um nome próprio sem tradução natural repita o original>
---HTML---
<html traduzido>`;

async function chamarClaude(modeloChave, glos, nome, html) {
  const modelo = MODELOS[modeloChave] || MODELOS.sonnet;
  let texto = '';
  const sessao = query({
    prompt: `Nome: ${nome}\n\nHTML:\n${html}`,
    options: {
      systemPrompt: INSTRUCOES(glos), tools: [], allowedTools: [], settingSources: [], maxTurns: 1,
      ...(modelo.id ? { model: modelo.id } : {}),
    },
  });
  for await (const msg of sessao) {
    if (msg.type === 'result') {
      if (msg.subtype !== 'success') throw new Error('Falha do Claude: ' + msg.subtype);
      texto = msg.result;
    }
  }
  const m = /NOME:\s*(.*?)\s*\n+\s*---HTML---\s*\n?([\s\S]*)$/.exec(texto);
  if (!m) throw new Error('Resposta da tradução veio em formato inesperado.');
  return { nome: m[1].trim(), html: m[2].trim().replace(/^```html\s*|```\s*$/g, '').trim() };
}

// Garante os termos obrigatórios caso o modelo deixe algum em inglês.
function aplicarGlossario(html, glos) {
  let h = html;
  for (const g of glos.filter((x) => x.obrigatorio)) {
    const re = new RegExp(`(?<![\\p{L}])${g.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu');
    h = h.replace(re, (m) => (m[0] === m[0].toUpperCase() ? g.pt[0].toUpperCase() + g.pt.slice(1) : g.pt));
  }
  return h;
}

// Remove o <h1> inicial do HTML original (o nome é mostrado à parte) e devolve o corpo a traduzir.
function corpo(htmlOriginal) {
  return htmlOriginal.replace(/^\s*<h1[\s\S]*?<\/h1>/i, '');
}

const emVoo = new Map();
export async function traduzir({ chave, nome, html, modelo = 'sonnet' }) {
  if (cache[chave]) return { ...cache[chave], doCache: true };
  if (emVoo.has(chave)) return emVoo.get(chave);
  const glos = lerGlossario();
  const p = (async () => {
    const r = await chamarClaude(modelo, glos, nome, corpo(html));
    const saida = { nome: r.nome, html: aplicarGlossario(r.html, glos), quando: new Date().toISOString(), modelo };
    cache[chave] = saida;
    gravarCache();
    return saida;
  })().finally(() => emVoo.delete(chave));
  emVoo.set(chave, p);
  return p;
}

export function traducaoSalva(chave) { return cache[chave] || null; }
