// Compêndio local (cópia do iws.mx / 4e Database em compendio\*.json) + tradução em português (compendio\pt.json):
// busca por nome e por texto nos dois idiomas, detalhe com HTML traduzido e ligação por nome.
import fs from 'node:fs';
import path from 'node:path';
import { COMPENDIO } from './caminhos.mjs';
import { aplicar, cobertura } from './segmentos.mjs';

const PASTA = COMPENDIO;
const ARQ_PT = path.join(PASTA, 'pt.json');
const cache = new Map();
const textoCache = new Map();

export const CATEGORIAS = {
  class: 'Classes', race: 'Raças', power: 'Poderes', feat: 'Talentos', item: 'Itens mágicos', weapon: 'Armas',
  armor: 'Armaduras', implement: 'Implementos', background: 'Antecedentes', theme: 'Temas', paragonpath: 'Caminhos paragonais',
  epicdestiny: 'Destinos épicos', deity: 'Divindades', ritual: 'Rituais', glossary: 'Glossário', companion: 'Companheiros',
  disease: 'Doenças', poison: 'Venenos', monster: 'Monstros', trap: 'Armadilhas',
};

export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&apos;|&#39;|’/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
}

// ---------- tradução
let PT = {}, ptMtime = 0;
function dicionario() {
  try {
    const m = fs.statSync(ARQ_PT).mtimeMs;
    if (m !== ptMtime) { PT = JSON.parse(fs.readFileSync(ARQ_PT, 'utf8')); ptMtime = m; textoCache.clear(); for (const d of cache.values()) if (d) for (const l of d.linhas) l._npt = undefined; }
  } catch { PT = PT || {}; }
  return PT;
}
export const dicPT = () => dicionario();
export const nomePT = (nome) => dicionario()[String(nome).trim()] || '';

export function carregar(cat) {
  if (!CATEGORIAS[cat]) return null;
  if (cache.has(cat)) return cache.get(cat);
  const arq = path.join(PASTA, cat + '.json');
  if (!fs.existsSync(arq)) { cache.set(cat, null); return null; }
  const bruto = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const cols = bruto.colunas;
  const linhas = bruto.linhas.map((l) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = Array.isArray(l[i]) ? l[i][0] : l[i]; });
    o._n = norm(o.Name);
    return o;
  });
  const porNome = new Map();
  for (const l of linhas) { if (!porNome.has(l._n)) porNome.set(l._n, []); porNome.get(l._n).push(l); }
  const dado = { colunas: cols, linhas, dados: bruto.dados, porNome };
  cache.set(cat, dado);
  return dado;
}

export function status() {
  const dic = dicionario();
  const r = {};
  for (const cat of Object.keys(CATEGORIAS)) {
    const arq = path.join(PASTA, cat + '.json');
    r[cat] = fs.existsSync(arq) ? { titulo: CATEGORIAS[cat], itens: carregar(cat).linhas.length } : { titulo: CATEGORIAS[cat], itens: 0 };
  }
  return { categorias: r, traduzidos: Object.keys(dic).length };
}

const nivelNum = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const semTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase();

// textos para busca "dentro do texto" (inglês e português), montados sob demanda por categoria
function textos(cat) {
  const dic = dicionario();
  if (textoCache.has(cat)) return textoCache.get(cat);
  const d = carregar(cat);
  const o = { en: new Map(), pt: new Map() };
  for (const l of d.linhas) {
    const h = d.dados[l.ID] || '';
    o.en.set(l.ID, norm(semTags(h)));
    o.pt.set(l.ID, norm(semTags(aplicar(h, dic))));
  }
  textoCache.set(cat, o);
  return o;
}
const nptDe = (l) => { if (l._npt === undefined) l._npt = norm(nomePT(l.Name)); return l._npt; };

// filtros: q (nome ou texto), classe, nivelMax, nivelMin, tipo, fonte, raridade (mundano|magico), texto (1 = procurar também no texto)
// extra(linha) = filtro adicional (compatibilidade de itens)
export function buscar(cat, f = {}, limite = 80, extra = null) {
  const d = carregar(cat);
  if (!d) return { total: 0, itens: [], colunas: [] };
  const q = norm(f.q);
  const classe = norm(f.classe);
  const tipo = norm(f.tipo);
  const fonte = norm(f.fonte);
  const max = f.nivelMax !== undefined && f.nivelMax !== '' ? nivelNum(f.nivelMax) : null;
  const min = f.nivelMin !== undefined && f.nivelMin !== '' ? nivelNum(f.nivelMin) : null;
  const achados = [];
  for (const l of d.linhas) {
    if (classe && norm(l.ClassName ?? l.Class ?? '') !== classe) continue;
    if (tipo && !norm(l.Type ?? l.Category ?? l.CreatureType ?? '').includes(tipo)) continue;
    if (f.funcao && !norm(l.CombatRole ?? '').includes(norm(f.funcao))) continue;
    if (f.grupo && norm(l.GroupRole ?? '') !== norm(f.grupo)) continue;
    if (fonte && !norm(l.SourceBook ?? '').includes(fonte)) continue;
    if (f.escudo === '1' && !/shield/i.test(l.Type || '')) continue;
    if (f.escudo === '0' && (/shield/i.test(l.Type || '') || /barding/i.test(l.Type || ''))) continue;
    if (f.raridade === 'mundano' && !/mundane/i.test(l.Rarity || '')) continue;
    if (f.raridade === 'magico' && /mundane/i.test(l.Rarity || '')) continue;
    const nv = nivelNum(l.Level);
    if (max !== null && nv !== null && nv > max) continue;
    if (min !== null && nv !== null && nv < min) continue;
    if (extra && !extra(l)) continue;
    achados.push(l);
  }
  let lista = achados, porNomeN = achados;
  if (q) {
    porNomeN = achados.filter((l) => l._n.includes(q) || nptDe(l).includes(q));
    lista = porNomeN;
    if (f.texto !== '0' && q.length >= 3) { // depois dos nomes, entradas que citam o termo no texto (EN ou PT)
      const t = textos(cat);
      const nomes = new Set(porNomeN.map((l) => l.ID));
      const doTexto = achados.filter((l) => !nomes.has(l.ID) && (t.en.get(l.ID)?.includes(q) || t.pt.get(l.ID)?.includes(q)));
      lista = [...porNomeN, ...doTexto.map((l) => ({ ...l, _texto: true }))];
    }
  }
  const ordem = (a, b) => {
    if (q) { const sa = a._n.startsWith(q) || nptDe(a).startsWith(q) ? 0 : 1, sb = b._n.startsWith(q) || nptDe(b).startsWith(q) ? 0 : 1; if (sa !== sb) return sa - sb; }
    return (nivelNum(a.Level) ?? 0) - (nivelNum(b.Level) ?? 0) || a._n.localeCompare(b._n);
  };
  const pri = lista.filter((l) => !l._texto).sort(ordem);
  const sec = lista.filter((l) => l._texto).sort(ordem);
  const todos = [...pri, ...sec];
  return {
    total: todos.length,
    colunas: d.colunas,
    itens: todos.slice(0, limite).map(({ _n, _npt, _texto, ...r }) => ({ ...r, NomePT: nomePT(r.Name), _no_texto: !!_texto })),
  };
}

export function buscarGlobal(q, limite = 40) {
  const nq = norm(q);
  if (nq.length < 2) return [];
  const saida = [];
  for (const cat of Object.keys(CATEGORIAS)) {
    if (cat === 'glossary') continue;
    const d = carregar(cat);
    if (!d) continue;
    for (const l of d.linhas) {
      const npt = nptDe(l);
      const acha = l._n.includes(nq) || npt.includes(nq);
      if (acha) saida.push({ cat, id: l.ID, nome: l.Name, pt: nomePT(l.Name), nivel: l.Level ?? '', info: l.Type ?? l.ClassName ?? l.Category ?? '', ini: l._n.startsWith(nq) || npt.startsWith(nq) ? 0 : 1 });
    }
  }
  saida.sort((a, b) => a.ini - b.ini || a.nome.localeCompare(b.nome));
  if (saida.length < limite && nq.length >= 3) { // completa com buscas no texto das cartas principais
    const vistos = new Set(saida.map((s) => s.cat + s.id));
    for (const cat of ['power', 'feat', 'item', 'class', 'race', 'theme', 'background', 'paragonpath', 'epicdestiny', 'ritual']) {
      const d = carregar(cat); if (!d) continue;
      const t = textos(cat);
      for (const l of d.linhas) {
        if (vistos.has(cat + l.ID)) continue;
        if (t.en.get(l.ID)?.includes(nq) || t.pt.get(l.ID)?.includes(nq)) { saida.push({ cat, id: l.ID, nome: l.Name, pt: nomePT(l.Name), nivel: l.Level ?? '', info: 'no texto', ini: 2 }); }
        if (saida.length >= limite * 2) break;
      }
    }
  }
  return saida.slice(0, limite);
}

// HTML do site: tira scripts, eventos e links (o app mostra só o texto das regras).
export function limparHtml(h) {
  return String(h ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?a\b[^>]*>/gi, '')
    .replace(/<img\b[^>]*>/gi, '');
}

export function detalhe(cat, id) {
  const d = carregar(cat);
  if (!d) return null;
  const l = d.linhas.find((x) => x.ID === id);
  if (!l || !d.dados[id]) return null;
  const { _n, _npt, ...meta } = l;
  const html = limparHtml(d.dados[id]);
  const dic = dicionario();
  const cob = cobertura(html, dic);
  return { cat, id, meta, nomePT: nomePT(meta.Name), html, htmlPT: cob > 0 ? aplicar(html, dic) : '', cobertura: cob };
}

// Acha a melhor entrada por nome. 'contexto' = { classe, nivel } ajuda a desempatar poderes homônimos.
export function acharPorNome(cat, nome, contexto = {}) {
  const d = carregar(cat);
  if (!d) return null;
  const n = norm(nome);
  let lista = d.porNome.get(n);
  if (!lista) {
    lista = d.porNome.get(norm(String(nome).replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ')));
  }
  if (!lista?.length) return null;
  if (lista.length === 1) return lista[0];
  const c = norm(contexto.classe);
  const nv = nivelNum(contexto.nivel);
  return [...lista].sort((a, b) => {
    const pa = (c && norm(a.ClassName) === c ? 0 : 2) + (nv !== null && nivelNum(a.Level) === nv ? 0 : 1);
    const pb = (c && norm(b.ClassName) === c ? 0 : 2) + (nv !== null && nivelNum(b.Level) === nv ? 0 : 1);
    return pa - pb;
  })[0];
}

export function limparCache() { cache.clear(); textoCache.clear(); }
