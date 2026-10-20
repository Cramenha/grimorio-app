// Traduz TODO o compêndio (nomes e textos) para português com o Claude e grava em compendio\pt.json.
// Roda uma vez (quem distribui o app); os amigos já recebem o arquivo pronto e não precisam de login.
// Retomável: só traduz o que ainda não está no dicionário.
// Uso: node traduzir-tudo.mjs [--modelo haiku|sonnet|opus] [--paralelo 4] [--cats power,feat] [--limite 200]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { trechos } from './segmentos.mjs';
import { GLOSSARIO_PADRAO } from './traduzir.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARQ = path.join(aqui, 'compendio', 'pt.json');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELOS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const modelo = MODELOS[arg('modelo', 'sonnet')];
const paralelo = +arg('paralelo', 4);
const limiteSeg = +arg('limite', 0);
const ORDEM = (arg('cats', '') ? arg('cats').split(',') : ['power', 'feat', 'class', 'race', 'theme', 'background', 'paragonpath', 'epicdestiny', 'deity',
  'armor', 'weapon', 'implement', 'item', 'ritual', 'companion', 'glossary', 'disease', 'poison', 'trap', 'monster']);

const dic = fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, 'utf8')) : {};
let sujo = false;
const gravar = () => {
  if (!sujo) return;
  fs.writeFileSync(ARQ + '.tmp', JSON.stringify(dic));
  for (let i = 0; i < 20; i++) { try { fs.renameSync(ARQ + '.tmp', ARQ); sujo = false; return; } catch (e) { if (i === 19) { console.log('  não consegui gravar agora:', e.code); return; } Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500); } }
};

const GLOS = [...GLOSSARIO_PADRAO,
  ['Hit', 'Acerto'], ['Miss', 'Erro'], ['Effect', 'Efeito'], ['Target', 'Alvo'], ['Targets', 'Alvos'], ['Attack', 'Ataque'], ['Requirement', 'Requisito'], ['Trigger', 'Gatilho'],
  ['Special', 'Especial'], ['Standard Action', 'Ação Padrão'], ['Move Action', 'Ação de Movimento'], ['Minor Action', 'Ação Menor'], ['Immediate Reaction', 'Reação Imediata'],
  ['Immediate Interrupt', 'Interrupção Imediata'], ['Opportunity Action', 'Ação de Oportunidade'], ['Free Action', 'Ação Livre'], ['No Action', 'Nenhuma Ação'],
  ['Melee', 'Corpo a corpo'], ['Ranged', 'À distância'], ['hit points', 'pontos de vida'], ['temporary hit points', 'pontos de vida temporários'],
  ['ongoing damage', 'dano contínuo'], ['resist', 'resistência'], ['vulnerable', 'vulnerabilidade'], ['action point', 'ponto de ação'], ['saving throw ends', 'teste de resistência encerra'],
  ['Weapon', 'Arma'], ['Implement', 'Implemento'], ['Arcane', 'Arcano'], ['Divine', 'Divino'], ['Martial', 'Marcial'], ['Primal', 'Primal'], ['Psionic', 'Psiônico'], ['Shadow', 'Sombrio'],
  ['Fire', 'Fogo'], ['Cold', 'Frio'], ['Lightning', 'Elétrico'], ['Thunder', 'Trovão'], ['Radiant', 'Radiante'], ['Necrotic', 'Necrótico'], ['Psychic', 'Psíquico'], ['Acid', 'Ácido'],
  ['Force', 'Energia'], ['Charm', 'Encantamento'], ['Conjuration', 'Conjuração'], ['Fear', 'Medo'], ['Healing', 'Cura'], ['Illusion', 'Ilusão'], ['Teleportation', 'Teletransporte'],
  ['Stance', 'Postura'], ['Reliable', 'Confiável'], ['Sleep', 'Sono'], ['Polymorph', 'Polimorfia'], ['Rage', 'Fúria'], ['Zone', 'Zona'],
  ['Strength', 'Força'], ['Constitution', 'Constituição'], ['Dexterity', 'Destreza'], ['Intelligence', 'Inteligência'], ['Wisdom', 'Sabedoria'], ['Charisma', 'Carisma'],
  ['AC', 'CA'], ['Fortitude', 'Fortitude'], ['Reflex', 'Reflexos'], ['Will', 'Vontade'], ['Heroic tier', 'patamar heroico'], ['paragon tier', 'patamar paragonal'], ['epic tier', 'patamar épico'],
].map((g) => (Array.isArray(g) ? { en: g[0], pt: g[1] } : g));

const SISTEMA = `Você traduz textos de regras de Dungeons & Dragons 4ª edição do inglês para o português do Brasil, no estilo dos livros oficiais em português (Galápagos).
Você recebe linhas numeradas "N<TAB>texto", agrupadas por entrada (linhas "## tipo: nome" dão contexto e NÃO devem ser traduzidas). Cada linha é um pedaço de texto de uma carta/verbete de regras.
Responda SOMENTE com as linhas traduzidas no formato "N<TAB>tradução", uma por linha de entrada, mesma numeração, sem comentários, sem linhas vazias.
Regras:
- Use o CONTEXTO da entrada para traduzir com sentido (um nome de poder é nome; "Hit:" é "Acerto:"; termos de regra no vocabulário usual do 4e).
- Nomes de poderes, talentos, itens, classes e raças: traduza de forma natural e curta, como num livro em português. Nomes próprios de pessoas, lugares, deuses e marcas ficam como estão.
- Mantenha exatamente: números, dados (2d8+4), símbolos (✦), colchetes [W], entidades HTML (&amp; &nbsp; etc.), pontuação e espaços das pontas.
- Mantenha no original em inglês, entre parênteses, apenas termos de regra citados que sejam nomes específicos de outros poderes/talentos (ex.: "use Second Wind" -> "use Second Wind (Retomar o Fôlego)" só na primeira menção do trecho; na dúvida, traduza e pronto).
- Não explique nada. Não una nem divida linhas.
- ORDEM DAS PALAVRAS em alcances e áreas: o tipo de criatura/entidade vem NA FRENTE e o formato do alcance depois. Ex.: "Melee spirit 1" -> "Espírito corpo a corpo 1"; "Melee beast 1" -> "Fera corpo a corpo 1"; "Close burst spirit 2" -> "Espírito explosão contígua 2". O mesmo vale para animal (animal), companheiro (companion).
- ÁREAS (número no fim, nunca troque): Close blast N = Rajada contígua N; Close burst N = Explosão contígua N; Area burst N = Explosão de área N; Area wall N = Muralha de área N; Melee N = Corpo a corpo N; Ranged N = À distância N; Melee touch = Corpo a corpo (toque).
- Seja consistente: a MESMA palavra inglesa recebe a MESMA tradução em toda a entrada e em todo o compêndio; nunca misture dois termos para a mesma coisa (por exemplo descanso longo, nunca extenso/prolongado/estendido; trilha exemplar, nunca caminho paragonal; sem limite, nunca à vontade).
- Trechos curtos que vêm separados (um rótulo em negrito seguido do texto) pertencem à MESMA frase: traduza pensando na frase inteira, mantendo a ordem natural do português.
GLOSSÁRIO (siga sempre, em qualquer flexão):
${GLOS.map((g) => `- ${g.en} = ${g.pt}${g.obrigatorio ? '  (OBRIGATÓRIO)' : ''}`).join('\n')}`;

// ------------- levanta o que falta traduzir, por entrada, na ordem de prioridade
const fila = []; // { cat, nome, itens: [texto, ...] }
const jaNaFila = new Set();
for (const cat of ORDEM) {
  const arq = path.join(aqui, 'compendio', cat + '.json');
  if (!fs.existsSync(arq)) continue;
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
  for (const l of j.linhas) {
    const nome = String(l[1]);
    const lista = [nome, ...trechos(j.dados[l[0]] || '')];
    const novos = [];
    for (const t of lista) {
      if (dic[t] || jaNaFila.has(t)) continue;
      jaNaFila.add(t); novos.push(t);
    }
    if (novos.length) fila.push({ cat, nome, itens: novos });
  }
}
let totalSeg = fila.reduce((a, e) => a + e.itens.length, 0);
console.log(`A traduzir: ${totalSeg} trechos em ${fila.length} entradas. Modelo ${modelo}, paralelo ${paralelo}.`);
if (!totalSeg) process.exit(0);

// ------------- lotes (~ 9 mil caracteres)
const lotes = [];
let atual = null;
for (const e of fila) {
  const tam = e.itens.reduce((a, t) => a + t.length + 8, 40);
  if (!atual || atual.chars + tam > 9000) { atual = { chars: 0, entradas: [] }; lotes.push(atual); }
  atual.entradas.push(e); atual.chars += tam;
}
const corte = limiteSeg ? lotes.slice(0, Math.max(1, Math.ceil(limiteSeg / 120))) : lotes;
console.log(`${corte.length} lotes.`);

const esc = (t) => t.replace(/\t/g, ' ').replace(/\n/g, ' ');
async function traduzLote(lote, tentativa = 0) {
  const linhas = []; const mapa = [];
  for (const e of lote.entradas) {
    linhas.push(`## ${e.cat}: ${esc(e.nome)}`);
    for (const t of e.itens) { mapa.push(t); linhas.push(`${mapa.length}\t${esc(t)}`); }
  }
  let texto = '';
  const s = query({ prompt: linhas.join('\n'), options: { systemPrompt: SISTEMA, tools: [], allowedTools: [], settingSources: [], maxTurns: 1, model: modelo } });
  for await (const msg of s) { if (msg.type === 'result') { if (msg.subtype !== 'success') throw new Error('claude: ' + msg.subtype); texto = msg.result; } }
  let ok = 0;
  for (const l of texto.split('\n')) {
    const m = /^(\d+)\t(.*)$/.exec(l.replace(/\r$/, ''));
    if (!m) continue;
    const original = mapa[+m[1] - 1];
    if (original === undefined || !m[2].trim()) continue;
    dic[original] = m[2].trim(); ok++; sujo = true;
  }
  if (ok < mapa.length * 0.9 && tentativa < 2) { console.log(`  lote incompleto (${ok}/${mapa.length}), tentando de novo`); return traduzLote({ ...lote, entradas: lote.entradas.map((e) => ({ ...e, itens: e.itens.filter((t) => !dic[t]) })).filter((e) => e.itens.length) }, tentativa + 1); }
  return ok;
}

let feitos = 0, trechosOk = 0;
const t0 = Date.now();
const trabalhador = async () => {
  while (corte.length) {
    const lote = corte.shift();
    try { trechosOk += await traduzLote(lote); } catch (e) { console.log('  erro no lote:', e.message); }
    feitos++; gravar();
    const dec = (Date.now() - t0) / 60000;
    console.log(`lote ${feitos}/${lotes.length} · ${trechosOk} trechos · ${dec.toFixed(1)} min · restam ${corte.length}`);
  }
};
await Promise.all(Array.from({ length: paralelo }, trabalhador));
gravar();
console.log('Concluído. Entradas no dicionário:', Object.keys(dic).length);
