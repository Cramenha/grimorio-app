// Efeitos de ataque/dano da ficha (talentos, itens, raça, tema, caminho, destino…) lidos de compendio\efeitos.json (extraído com o Claude por
// extrair-efeitos.mjs) e filtrados para um poder e uma arma/implemento. Cada efeito vira uma de cinco coisas:
//   fixo       bônus sempre válido (entra no total; ou, se depende do poder, vai direto na macro do Roll20)
//   pergunta   tem condição que o jogador responde Sim/Não na hora (caixa no Roll20; fora do total)
//   critico    dano extra que só vale em acerto crítico (soma na linha de crítico)
//   info       condição que o aplicativo não sabe responder, ou depende de uma escolha: só texto informativo
//   (ignorado) não se aplica a este poder/arma/nível
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as comp from './compendio.mjs';
import { efeitosDoTexto, valorNoNivel } from './efeitos-texto.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
let DB = null, dbM = 0;
let FORCADO = null;
// para testes: usa este objeto no lugar de compendioefeitos.json (null volta ao arquivo)
export function definirBancoDeEfeitos(obj) { FORCADO = obj; }
function db() {
  if (FORCADO) return FORCADO;
  const arq = path.join(aqui, 'compendio', 'efeitos.json');
  try { const m = fs.statSync(arq).mtimeMs; if (!DB || m !== dbM) { DB = JSON.parse(fs.readFileSync(arq, 'utf8')); dbM = m; } } catch { DB = DB || {}; }
  return DB;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const PREFIXO = { feat: 'Talento', race: 'Raça', theme: 'Tema', paragonpath: 'Caminho', epicdestiny: 'Destino', background: 'Antecedente', item: 'Item', weapon: 'Item', implement: 'Item', armor: 'Item', class: 'Classe' };

// do formato antigo (regex em efeitos-texto.mjs) para o do efeitos.json, quando a entrada ainda não foi extraída
function doRegex(html) {
  const e = efeitosDoTexto(html);
  const base = { dice: null, damageType: null, askable: false, minLevel: 1, viaPower: null, choice: false };
  return [
    ...e.bonus.map((b) => ({ ...base, stat: b.stat.startsWith('attack') ? 'attack' : 'damage', value: null, bonusType: b.tipo, scaling: b.escala, condition: null, conditionPt: null,
      appliesTo: { weaponGroups: b.grupos, keywords: [], powerKinds: [], attackKind: 'any', implementOnly: false, weaponOnly: b.soArma } })),
    ...e.condicionais.map((c) => ({ ...base, stat: 'damage', value: c.valor, bonusType: 'untyped', scaling: null, condition: c.condicao, conditionPt: null, askable: true,
      appliesTo: { weaponGroups: c.grupos, keywords: [], powerKinds: [], attackKind: 'any', implementOnly: false, weaponOnly: true } })),
  ];
}

// Todos os efeitos que a ficha tem (sem filtrar por poder). origem = { nome, cat, id, item }; item != null quando vem de uma arma/implemento equipado
export function efeitosDaFicha(P) {
  const D = db(), lista = [];
  const add = (cat, id, item, itemNivel) => {
    if (!id) return;
    const reg = D[`${cat}:${id}`];
    let efeitos = reg?.efeitos, nome = reg?.nome;
    if (!reg && cat === 'feat') { const d = comp.detalhe('feat', id); if (d) { efeitos = doRegex(d.html); nome = d.meta?.Name; } }
    for (const e of efeitos || []) lista.push({ ...e, origem: { nome: nome || '', cat, id, item: item || null, itemNivel: itemNivel || null } });
  };
  for (const f of P.talentos || []) add('feat', f.id);
  for (const [campo, cat] of [['raca', 'race'], ['tema', 'theme'], ['paragon', 'paragonpath'], ['destino', 'epicdestiny'], ['antecedente', 'background']]) add(cat, P[campo]?.id);
  if (P.classe?.id) add('class', P.classe.id);
  for (const it of (P.itens || []).filter((i) => i.equipado)) {
    const escopo = it.cat === 'weapon' || it.cat === 'implement' ? it : null; // propriedade de arma/implemento só vale quando é ela que ataca
    const nv = +it.ench?.nivel || +it.variante?.nivel || null;
    if (it.ench?.id) add(it.ench.cat || it.cat, it.ench.id, escopo, nv);
    if (it.base?.id) add(it.cat, it.base.id, escopo, null);
    if (it.ref?.id) add(it.ref.cat || 'item', it.ref.id, escopo, nv);
    if (it.augment?.id) add(it.augment.cat || 'weapon', it.augment.id, escopo, +it.augment.nivel || null); // augment (Dragonshard) encaixado: vale só para esta arma
  }
  return lista;
}

const grupoServe = (grupos, grupoArma) => { const g = String(grupoArma || '').split(/[,/]| or /).map((x) => x.trim()).filter(Boolean); return grupos.some((x) => g.includes(String(x).toLowerCase())); };
const KINDS = new Set(['at-will', 'encounter', 'daily']);

// ctx = { nivel, s (fonte: tipo, grupo, item), power: { nome, palavras[], tipo, alcance } | null }
// -> null | { classe: 'fixo'|'pergunta'|'critico'|'info', especificoDoPoder, valor, dados }
export function classificar(e, ctx) {
  if (e.stat !== 'attack' && e.stat !== 'damage') return null;
  const ehItem = ['item', 'weapon', 'implement', 'armor'].includes(e.origem.cat);
  const nivelEscala = ehItem && e.origem.itemNivel ? e.origem.itemNivel : ctx.nivel; // itens: a escala e o nível mínimo são do item
  if ((e.minLevel || 1) > nivelEscala) return null;
  const a = e.appliesTo || {};
  const tipo = ctx.s.tipo;
  if (e.origem.item && e.origem.item !== ctx.s.item) return null;
  if (a.weaponOnly && tipo !== 'weapon') return null;
  if (a.implementOnly && tipo !== 'implement') return null;
  // grupos E nomes de arma são alternativas ("com espadas longas e todas as lanças"): serve qualquer um
  if (a.weaponGroups?.length || a.weaponNames?.length) {
    const porGrupo = a.weaponGroups?.length && tipo === 'weapon' && grupoServe(a.weaponGroups, ctx.s.grupo);
    const porNome = a.weaponNames?.length && tipo === 'weapon' && a.weaponNames.some((n) => norm(n) === norm(ctx.s.w?.nome));
    if (!porGrupo && !porNome) return null;
  }
  const especifico = !!(e.viaPower || a.keywords?.length || a.powerKinds?.length || (a.attackKind && a.attackKind !== 'any'));
  if (especifico && !ctx.power) return null; // sem poder (campos fixos da arma) não dá para saber
  if (ctx.power) {
    if (e.viaPower && norm(e.viaPower) !== norm(ctx.power.nome)) return null;
    const pal = ctx.power.palavras.map((x) => x.toLowerCase());
    if (a.keywords?.length && !a.keywords.some((k) => pal.includes(String(k).toLowerCase()))) return null;
    if (a.powerKinds?.length) {
      const kinds = new Set(); const t = ctx.power.tipo.toLowerCase();
      for (const k of KINDS) if (t.includes(k.replace('-', '')) || t.includes(k)) kinds.add(k);
      if (/basic attack/i.test(ctx.power.nome)) kinds.add('basic attack');
      if (!a.powerKinds.some((k) => kinds.has(String(k).toLowerCase()))) return null;
    }
    if (a.attackKind === 'melee' && !/melee/i.test(ctx.power.alcance)) return null;
    if (a.attackKind === 'ranged' && !/ranged|area/i.test(ctx.power.alcance)) return null;
  }
  let valor = e.value, dados = e.dice;
  if (Array.isArray(e.scaling) && e.scaling.length) { // [[nível, valor ou "NdX"], ...]: vale o último degrau já atingido
    const degrau = e.scaling.filter(([n]) => n <= nivelEscala).pop();
    if (!degrau) return null;
    if (typeof degrau[1] === 'string') { dados = degrau[1]; valor = null; } else { valor = degrau[1]; dados = null; }
  }
  // "+1d8 para cada +1 de aprimoramento da arma/implemento": multiplica os dados pelo aprimoramento
  const porAprimoramento = /(para cada|por cada|por unidade|a cada|each|per)[^.]{0,40}\+1[^.]{0,30}(aprimoramento|enhancement)|por unidade de aprimoramento|unidades? de aprimoramento/i.test(e.note || '');
  if (dados && porAprimoramento && ctx.s.item?.ench?.mais) { const m = /^(\d+)d(\d+)$/.exec(dados); if (m) dados = `${+m[1] * ctx.s.item.ench.mais}d${m[2]}`; }
  let classe, perguntaNoCritico = false;
  const cond = e.condition || '';
  if (valor == null && !dados) classe = 'info'; // valor que depende de outra coisa (ex.: modificador de Destreza): só informativo, com a nota
  else if (/critical hit/i.test(cond) && e.stat === 'damage') {
    classe = 'critico';
    perguntaNoCritico = cond.replace(/\b(on|a|an|the|critical hit|crit|against|with|when|you|score|land|make|hit)\b/gi, '').replace(/[^a-z]/gi, '').length > 3 && !!e.askable; // crítico E mais uma condição: pergunta só na linha de crítico
  }
  else if (e.choice) classe = 'info';
  else if (cond) classe = e.askable ? 'pergunta' : 'info';
  else classe = 'fixo';
  return { classe, especificoDoPoder: especifico, valor, dados, perguntaNoCritico };
}

export const rotuloOrigem = (o) => `${PREFIXO[o.cat] || 'Fonte'}: ${o.nome}`;
export const maximoDosDados = (d) => { const m = /^(\d+)d(\d+)$/.exec(d || ''); return m ? +m[1] * +m[2] : 0; };
