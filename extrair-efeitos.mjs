// Extrai do compêndio os bônus de ataque/dano CONDICIONAIS (e os fixos por arma) de talentos, itens, caminhos, destinos, temas e raças,
// com o Claude, e grava compendio\efeitos.json. Roda uma vez (quem mantém o app); o app usa o arquivo pronto, sem IA e sem login.
// Retomável: só processa o que ainda não está no arquivo.
// Uso: node extrair-efeitos.mjs [--modelo haiku|sonnet] [--paralelo 4] [--cats feat,item] [--amostra "Axe Expertise,Headsman's Chop"] [--limite 50]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '@anthropic-ai/claude-agent-sdk';
import * as comp from './compendio.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARQ = path.join(aqui, 'compendio', 'efeitos.json');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELOS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' };
const modelo = MODELOS[arg('modelo', 'haiku')];
const paralelo = +arg('paralelo', 4);
const limite = +arg('limite', 0);
const amostra = arg('amostra', '') ? arg('amostra').split(',').map((x) => x.trim().toLowerCase()) : null;
const CATS = arg('cats', 'feat,item,weapon,implement,armor,paragonpath,epicdestiny,theme,race,class,background').split(',');

const texto = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// pré-filtro barato: só manda ao Claude o que menciona bônus de ataque/dano
const EFEITO = /(bonus to (?:\w+ ){0,3}(?:attack|damage) rolls?|extra (?:\w+ )?damage|\d+(?:d\d+)? (?:\w+ )?damage when|deals? \d+(?:d\d+)? extra|\+\d+ [\w ]{0,20}damage|bonus to attacks?)/i;

const dic = fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, 'utf8')) : {};
const gravar = () => { fs.writeFileSync(ARQ + '.tmp', JSON.stringify(dic)); fs.renameSync(ARQ + '.tmp', ARQ); };

const SISTEMA = `Você lê o texto de uma regra de D&D 4e (talento, item, caminho paragonal, tema, raça…) e extrai SÓ os bônus de ATAQUE ou de DANO que o personagem soma nas rolagens dos seus poderes. Responda APENAS com um array JSON (sem texto fora dele). Array vazio [] se não houver nenhum.

Cada elemento:
{ "stat": "attack" | "damage",
  "value": número inteiro ou null,            // +2 de bônus -> 2
  "dice": "1d6" ou null,                      // "1d6 extra damage" -> dice "1d6", value null
  "damageType": "fire"|"cold"|… ou null,
  "bonusType": "feat"|"item"|"power"|"racial"|"enhancement"|"proficiency"|"untyped",
  "scaling": [[nívelMínimo, valor], ...] ou null,   // "+1, +2 at 11th level, +3 at 21st" -> [[1,1],[11,2],[21,3]] (use dice em vez de value se forem dados)
  "condition": null | "texto curto em inglês da condição",   // null = vale sempre que o resto (alcance/arma) se aplica
  "conditionPt": null | "condição curta em português, para uma pergunta de Sim/Não (ex.: 'Alvo derrubado?')",
  "askable": true | false,   // true se o jogador consegue responder Sim/Não na hora do ataque (estado do alvo, estar sangrando, ter vantagem de combate, primeiro ataque do turno…). false se depende de algo que o aplicativo não sabe e nem dá para perguntar de forma simples (efeito de aliado, ponto de ação já gasto em outro turno, uma vez por encontro…)
  "appliesTo": { "weaponGroups": [], "weaponNames": [], "keywords": [], "powerKinds": [], "attackKind": "melee"|"ranged"|"any", "implementOnly": false, "weaponOnly": false },
  "minLevel": nível mínimo do personagem para o efeito valer (ex.: característica de caminho paragonal "(11th level)" -> 11; use 1 se não houver),
  "viaPower": null | "nome exato do poder específico que o efeito exige (ex.: \"Dragon Breath\", \"Hunter's Quarry\")",
  "choice": true | false,   // true se depende de uma escolha do jogador que o texto não diz (ex.: "o grupo de armas escolhido")
  "note": "o que for importante e não cabe acima (curto)" }

Regras:
- weaponNames: quando o texto cita ARMAS ESPECÍFICAS ("com espadas longas", "com adagas"), liste os nomes em minúsculas e no singular ("longsword", "dagger") e deixe weaponGroups vazio; use weaponGroups só quando o texto fala do grupo inteiro ("com machados", "com lâminas pesadas"). "all spears"/"todas as lanças" é o grupo "spear".
- weaponGroups em minúsculas e no singular ("axe", "heavy blade", "light blade", "hammer", "bow"); vazio = qualquer arma.
- keywords: palavras-chave do poder exigidas ("fire", "radiant", "arcane", "martial"…); powerKinds: "at-will", "encounter", "daily", "basic attack", "opportunity attack"…; vazio = qualquer.
- Se o texto diz "bonus to attack rolls and damage rolls", devolva DOIS elementos (attack e damage).
- NÃO inclua o bônus de aprimoramento (+1 a +6, "enhancement bonus") que é a própria encantação de uma arma, armadura ou implemento: o aplicativo já o soma. Inclua só bônus ADICIONAIS (propriedades, dano extra, bônus condicionais).
- "condition" é SÓ para algo que o jogador precisa responder na hora ou que o aplicativo não sabe (estado do alvo, estar sangrando, uma vez por encontro, efeito de aliado…). Se a frase só repete o escopo já descrito em appliesTo ("com machados", "poderes com a palavra-chave fire", "ataque de oportunidade", "ataques corpo a corpo", "ao usar este implemento"), a condição é null e o bônus vale sempre que o escopo se aplicar.
- keywords vale como QUALQUER UMA das palavras listadas ("necrotic or psychic" -> ["necrotic","psychic"]).
- Ignore bônus de defesa, velocidade, perícias, testes de resistência, cura e efeitos sem número de ataque/dano.
- Não invente: só o que o texto afirma. Texto sem bônus de ataque/dano -> [].`;

const reprocessarGrupos = process.argv.includes('--reprocessar-grupos'); // refaz as entradas com grupo de arma (para preencher weaponNames)
const reprocessar = process.argv.includes('--reprocessar-info'); // refaz só as entradas com condição que não é perguntável (a IA às vezes repete o escopo da arma na condição)
const fila = [];
for (const cat of CATS) {
  const r = comp.buscar(cat, {}, 100000);
  for (const it of r.itens) {
    const chave = `${cat}:${it.ID}`;
    const refazer = (reprocessar && (dic[chave]?.efeitos || []).some((e) => e.condition && !e.askable && !e.choice)) || (reprocessarGrupos && (dic[chave]?.efeitos || []).some((e) => e.appliesTo?.weaponGroups?.length && !e.appliesTo?.weaponNames));
    if (dic[chave] !== undefined && !refazer) continue;
    if (amostra && !amostra.includes(String(it.Name).toLowerCase())) continue;
    const d = comp.detalhe(cat, it.ID); if (!d) continue;
    const t = texto(d.html);
    if (!EFEITO.test(t)) { dic[chave] = { nome: it.Name, efeitos: [] }; continue; }
    fila.push({ chave, nome: it.Name, cat, t: t.slice(0, 3500) });
  }
}
gravar();
const alvo = limite ? fila.slice(0, limite) : fila;
console.log(`Candidatos: ${fila.length} (de ${CATS.join(', ')}). Processando ${alvo.length} com ${modelo}, paralelo ${paralelo}.`);

let feitos = 0, tokensIn = 0, tokensOut = 0, custo = 0;
async function um(x) {
  const prompt = `Nome: ${x.nome} (${x.cat})\nTexto: ${x.t}`;
  let resp = '';
  const s = query({ prompt, options: { systemPrompt: SISTEMA, tools: [], allowedTools: [], settingSources: [], maxTurns: 1, model: modelo } });
  for await (const m of s) {
    if (m.type === 'assistant') for (const b of m.message?.content || []) if (b.type === 'text') resp += b.text;
    if (m.type === 'result') { tokensIn += (m.usage?.input_tokens || 0) + (m.usage?.cache_read_input_tokens || 0) + (m.usage?.cache_creation_input_tokens || 0); tokensOut += m.usage?.output_tokens || 0; custo += m.total_cost_usd || 0; }
  }
  const j = /\[[\s\S]*\]/.exec(resp);
  let efeitos = null;
  try { efeitos = j ? JSON.parse(j[0]) : null; } catch { /* resposta fora do formato */ }
  if (!Array.isArray(efeitos)) { console.log('  formato inválido:', x.nome); return; }
  dic[x.chave] = { nome: x.nome, efeitos };
  feitos++;
}
let i = 0;
await Promise.all(Array.from({ length: paralelo }, async () => {
  while (i < alvo.length) {
    const x = alvo[i++];
    try { await um(x); } catch (e) { console.log('  erro em', x.nome, '-', String(e.message).slice(0, 120)); if (/limit|usage/i.test(e.message)) { i = alvo.length; } }
    if (feitos % 10 === 0) gravar();
  }
}));
gravar();
console.log(`Feito: ${feitos}/${alvo.length}. Tokens: ${tokensIn} entrada, ${tokensOut} saída. Custo equivalente: US$ ${custo.toFixed(3)}.`);
