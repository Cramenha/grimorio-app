// Grimório do Aventureiro: servidor local. O app desktop (electron/main.mjs) roda este mesmo servidor na porta 3103; `npm run web` o serve sozinho na 3102.
// Sem IA e sem login: compêndio, tradução e regras de cálculo vêm em arquivos (compendio\).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as comp from './compendio.mjs';
import * as imp from './importar.mjs';
import * as calc from './calculo.mjs';
import { calculatePowerStats } from './poder-stats.mjs';
import * as dnd4e from './dnd4e-export.mjs';
import * as fnd from './foundry-ficha.mjs';
import * as pdf from './pdf-ficha.mjs';
import * as r20 from './roll20.mjs';
import * as r20f from './roll20-ficha.mjs';
import * as cri from './criatura.mjs';
import { DADOS } from './caminhos.mjs';

const PASTA = path.dirname(fileURLToPath(import.meta.url));
const PERS = path.join(DADOS, 'personagens');
const LIXEIRA = path.join(DADOS, 'lixeira');
const PORTA = Number(process.env.GRIMORIO_PORTA) || 3102;
const VERSAO = JSON.parse(fs.readFileSync(path.join(PASTA, 'package.json'), 'utf8')).version;
fs.mkdirSync(PERS, { recursive: true });
fs.mkdirSync(LIXEIRA, { recursive: true });

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const ESTATICOS = new Set(['index.html', 'app.js', 'criatura.js', 'style.css']);
// Bootstrap e fontes servidos de node_modules (sem CDN: o app funciona offline). /vendor/<pacote>/<arquivo>
const VENDOR = ['bootstrap/dist/', '@fontsource/cinzel/', '@fontsource/signika/'];

// Atualizações só existem no app desktop: o electron/main.mjs injeta o electron-updater. Fora dele (npm run web) não há o que atualizar.
const atualizador = globalThis.grimorioAtualizador || {
  verificar: async () => ({ ok: false, motivo: 'dev', atual: VERSAO }),
  instalar: async () => { throw new Error('Atualizações só no app instalado.'); },
};

const ok = (res, obj, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const erro = (res, msg, code = 400) => ok(res, { erro: msg }, code);

function corpo(req, limite = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const partes = []; let total = 0;
    req.on('data', (c) => { total += c.length; if (total > limite) { reject(new Error('Arquivo grande demais.')); req.destroy(); } else partes.push(c); });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}
const json = async (req) => { const b = await corpo(req); return b.length ? JSON.parse(b.toString('utf8')) : {}; };

const idOk = (id) => /^[a-z0-9]{6,24}$/.test(id || '');
const arqPers = (id) => path.join(PERS, id + '.json');

function listarPersonagens() {
  return fs.readdirSync(PERS).filter((f) => f.endsWith('.json')).map((f) => {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(PERS, f), 'utf8'));
      return { id: p.id, tipo: p.tipo || 'personagem', nome: p.nome, raca: p.tipo === 'criatura' ? (p.tipoTexto || '') : (p.raca?.nome || ''), classe: p.tipo === 'criatura' ? cri.resumoLista(p) : (/^hybrid/i.test(p.classe?.nome || '') ? 'Híbrido: ' + (p.extras || []).filter((e) => /^ID_FMP_HYBRID_CLASS_/.test(e.id)).map((e) => e.nome.replace(/^Hybrid\s+/i, '')).join(' + ') : (p.classe?.nome || '')), nivel: p.nivel, atualizado: p.atualizado, retrato: p.retrato ? true : false, notas: p.notas?.length || 0 };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''));
}

const BACKUPS = path.join(DADOS, 'backups');
const ultimoBackup = new Map();
function backupRotativo(p, texto) {
  // cópia de segurança a cada 5 min por ficha, guarda as 20 últimas
  if (Date.now() - (ultimoBackup.get(p.id) || 0) < 300000) return;
  ultimoBackup.set(p.id, Date.now());
  try {
    const dir = path.join(BACKUPS, p.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, Date.now() + '.json'), texto);
    const arqs = fs.readdirSync(dir).sort();
    for (const f of arqs.slice(0, Math.max(0, arqs.length - 20))) fs.unlinkSync(path.join(dir, f));
  } catch (e) { console.error('backup falhou:', e.message); }
}

function salvarPersonagem(p) {
  if (!idOk(p.id)) throw new Error('ID inválido.');
  p.atualizado = new Date().toISOString();
  const texto = JSON.stringify(p);
  const tmp = arqPers(p.id) + '.tmp';
  fs.writeFileSync(tmp, texto);
  fs.renameSync(tmp, arqPers(p.id));
  backupRotativo(p, texto);
  return p;
}

let atualizandoComp = null;

async function rota(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  const q = Object.fromEntries(u.searchParams);

  // estáticos
  if (req.method === 'GET' && p.startsWith('/vendor/')) {
    const rel = path.posix.normalize(decodeURIComponent(p.slice(8)));
    if (!VENDOR.some((v) => rel.startsWith(v)) || rel.includes('..')) { res.writeHead(404); return res.end('Não encontrado'); }
    const arq = path.join(PASTA, 'node_modules', rel);
    if (!fs.existsSync(arq)) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' });
    return res.end(fs.readFileSync(arq));
  }
  // token do Reticle (verificação no navegador, só em desenvolvimento com `npm run web`): nunca dentro do Electron.
  // Sem token responde um módulo vazio (e não 404), para o index.html não sujar o console do app com erro de rede.
  if (req.method === 'GET' && p === '/reticle.local.js') {
    const arq = path.join(PASTA, 'reticle.local.js');
    const usar = !process.versions.electron && fs.existsSync(arq);
    res.writeHead(200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-cache' });
    return res.end(usar ? fs.readFileSync(arq) : 'export const token = null;\n');
  }
  if (req.method === 'GET' && !p.startsWith('/api/')) {
    const nome = p === '/' ? 'index.html' : p.slice(1);
    if (!ESTATICOS.has(nome)) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(nome)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    return res.end(fs.readFileSync(path.join(PASTA, nome)));
  }

  // personagens
  if (p === '/api/personagens' && req.method === 'GET') return ok(res, listarPersonagens());
  if (p === '/api/personagens' && req.method === 'POST') {
    const d = await json(req);
    return ok(res, salvarPersonagem(imp.novoPersonagem(d.base || {})));
  }
  const m = /^\/api\/personagens\/([a-z0-9]+)$/.exec(p);
  if (m) {
    if (!idOk(m[1])) return erro(res, 'ID inválido.');
    if (req.method === 'GET') return fs.existsSync(arqPers(m[1])) ? ok(res, JSON.parse(fs.readFileSync(arqPers(m[1]), 'utf8'))) : erro(res, 'Personagem não encontrado.', 404);
    if (req.method === 'PUT' || req.method === 'POST') { // POST vem do sendBeacon ao fechar a aba
      const d = await json(req);
      d.id = m[1];
      return ok(res, { ok: true, atualizado: salvarPersonagem(d).atualizado });
    }
    if (req.method === 'DELETE') {
      if (fs.existsSync(arqPers(m[1]))) fs.renameSync(arqPers(m[1]), path.join(LIXEIRA, `${m[1]}-${Date.now()}.json`));
      return ok(res, { ok: true });
    }
  }

  // segurança dos dados: onde ficam, backup total, restauração e lixeira
  if (p === '/api/dados-info' && req.method === 'GET') return ok(res, { pasta: PERS, backups: BACKUPS, total: fs.readdirSync(PERS).filter((f) => f.endsWith('.json')).length });
  if (p === '/api/backup-total' && req.method === 'GET') {
    const fichas = fs.readdirSync(PERS).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(PERS, f), 'utf8')));
    return ok(res, { formato: 'grimorio-backup', quando: new Date().toISOString(), fichas });
  }
  if (p === '/api/restaurar-total' && req.method === 'POST') {
    const d = await json(req);
    if (d?.formato !== 'grimorio-backup' || !Array.isArray(d.fichas)) return erro(res, 'Arquivo não é um backup do Grimório.');
    let n = 0;
    for (const f of d.fichas) if (f && idOk(f.id)) { const at = f.atualizado; salvarPersonagem(f); f.atualizado = at; n++; }
    return ok(res, { restauradas: n });
  }
  if (p === '/api/lixeira' && req.method === 'GET') {
    return ok(res, fs.readdirSync(LIXEIRA).filter((f) => f.endsWith('.json')).map((f) => {
      try { const x = JSON.parse(fs.readFileSync(path.join(LIXEIRA, f), 'utf8')); return { arquivo: f, nome: x.nome, nivel: x.nivel, notas: x.notas?.length || 0, atualizado: x.atualizado }; } catch { return null; }
    }).filter(Boolean).sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || '')));
  }
  if (p === '/api/lixeira/restaurar' && req.method === 'POST') {
    const d = await json(req);
    const f = path.basename(String(d.arquivo || ''));
    const orig = path.join(LIXEIRA, f);
    if (!/^[a-z0-9]+-\d+\.json$/.test(f) || !fs.existsSync(orig)) return erro(res, 'Arquivo não encontrado na lixeira.', 404);
    const x = JSON.parse(fs.readFileSync(orig, 'utf8'));
    if (fs.existsSync(arqPers(x.id))) x.id = imp.novoId();
    salvarPersonagem(x);
    fs.unlinkSync(orig);
    return ok(res, { id: x.id });
  }

  // criaturas (monstros, chefes, NPCs)
  if (p === '/api/criatura/nova' && req.method === 'POST') {
    const d = await json(req);
    const base = d.monstroId ? cri.monstroDoCompendio(d.monstroId) : cri.novaCriatura(d.base || {});
    if (!base) return erro(res, 'Monstro não encontrado.', 404);
    if (d.monstroId) base.historico = [{ quando: base.criado, tipo: 'criacao', texto: `Criada a partir de ${base.origem?.nome} (compêndio).` }];
    return ok(res, salvarPersonagem(base));
  }
  if (p === '/api/criatura/derivar' && req.method === 'POST') {
    const c = await json(req);
    const macros = {};
    for (const pd of c.poderes || []) { try { macros[pd.id] = cri.macroPoder(c, pd); } catch { macros[pd.id] = ''; } }
    return ok(res, { derivados: cri.derivar(c), bloco: cri.blocoHtml(c), macros });
  }
  if (p === '/api/criatura/sugerir' && req.method === 'POST') {
    const d = await json(req);
    const c = d.criatura;
    if (d.poder) { const pd = d.poder; return ok(res, { ataque: (pd.ataque || d.defesa) ? cri.ataqueSugerido(c, pd.ataque?.defesa || d.defesa || 'AC', pd) : null, dano: cri.danoSugerido(c, pd) }); }
    return ok(res, { estatisticas: cri.sugerir(c), atributos: cri.atributosSugeridos(c) });
  }
  if (p === '/api/criatura/modelo') { const c = cri.monstroDoCompendio(q.id); return c ? ok(res, c) : erro(res, 'Monstro não encontrado.', 404); }
  if (p === '/api/criatura/poderes-busca') return ok(res, cri.buscarPoderesMonstro(q)); // "colcha de retalhos": poder a poder, de vários monstros
  // compêndio e cálculo
  if (p === '/api/comp/status') return ok(res, { ...comp.status(), atualizando: !!atualizandoComp });
  if (p === '/api/comp/buscar') {
    const extra = q.baseId ? calc.filtroCompat(q.baseCat, { id: q.baseId }) : null; // só encantamentos que servem ao equipamento escolhido
    return ok(res, comp.buscar(q.cat, q, Math.min(+q.limite || 80, 300), extra));
  }
  if (p === '/api/comp/variantes') return ok(res, { variantes: calc.variantes(q.cat, q.id), armadura: q.cat === 'armor' ? calc.infoArmadura(q.id) : null, arma: q.cat === 'weapon' ? calc.infoArma('weapon', q.id) : null });
  if (p === '/api/calcular' && req.method === 'POST') return ok(res, calc.calcular(await json(req)));
  // acerto e dano por poder (uma única função para o Builder e a Sheet): { ficha, ids: [idDoPoder...] } -> { stats: { id: resultado } }
  if (p === '/api/poder-stats' && req.method === 'POST') {
    const d = await json(req);
    const c = calc.calcular(d.ficha);
    const stats = {};
    for (const id of d.ids || []) { try { stats[id] = calculatePowerStats(d.ficha, { id }, c); } catch (e) { stats[id] = { erro: e.message }; } }
    return ok(res, { stats });
  }
  if (p === '/api/raca-info') return ok(res, calc.infoRaca({ raca: { id: q.id } }) || {});
  if (p === '/api/comp/global') return ok(res, comp.buscarGlobal(q.q));
  if (p === '/api/comp/macro') { const m = r20.gerarMacros(q.cat, q.id, q.lang === 'en' ? 'en' : 'pt'); return m ? ok(res, m) : erro(res, 'Este item não tem macro (só poderes, talentos e itens mágicos).', 404); }
  if (p === '/api/comp/item') { const d = comp.detalhe(q.cat, q.id); return d ? ok(res, { ...d, macro: r20.suporta(q.cat, q.id) }) : erro(res, 'Não encontrado.', 404); }
  if (p === '/api/comp/estrutura') { // campos separados (nome/tipo/ação/alcance/rotulo:texto) de um poder/talento/item, para editar (reskin/hotfix)
    const d = comp.detalhe(q.cat, q.id); if (!d) return erro(res, 'Não encontrado.', 404);
    const html = (q.lang === 'pt' && d.htmlPT) ? d.htmlPT : d.html;
    return ok(res, { nome: d.nomePT && q.lang === 'pt' ? d.nomePT : d.meta.Name, ...r20.analisar(html) });
  }
  if (p === '/api/comp/atualizar' && req.method === 'POST') {
    if (atualizandoComp) return ok(res, { ok: true, jaRodando: true });
    atualizandoComp = fork(path.join(PASTA, 'baixar-compendio.mjs'), [], { silent: true });
    atualizandoComp.on('exit', () => { atualizandoComp = null; comp.limparCache(); });
    return ok(res, { ok: true });
  }

  // PDF editável: exportar a ficha com campos de formulário
  if (p === '/api/exportar-roll20' && req.method === 'POST') {
    const ficha = await json(req);
    return ok(res, ficha.tipo === 'criatura' ? cri.exportarRoll20Criatura(ficha) : r20f.exportarRoll20(ficha, q.lang === 'en' ? 'en' : 'pt'));
  }
  if (p === '/api/importador-roll20') {
    const js = fs.readFileSync(path.join(PASTA, 'grimorio-importador.js'));
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Content-Disposition': 'attachment; filename="grimorio-importador.js"', 'Content-Length': js.length });
    return res.end(js);
  }
  if (p === '/api/exportar-pdf' && req.method === 'POST') {
    const ficha = await json(req);
    const bytes = await pdf.gerarPdf(ficha);
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': bytes.length });
    return res.end(bytes);
  }

  if (p === '/api/exportar-dnd4e' && req.method === 'POST') {
    const ficha = await json(req);
    if (ficha.tipo === 'criatura') return erro(res, 'Criaturas não existem no Character Builder.');
    try { return ok(res, dnd4e.exportarDnd4e(ficha)); } catch (e) { return erro(res, 'Falha ao gerar o .dnd4e: ' + e.message, 500); }
  }

  if (p === '/api/exportar-foundry' && req.method === 'POST') {
    const ficha = await json(req);
    try { return ok(res, fnd.exportarFoundry(ficha, q.lang === 'en' ? 'en' : 'pt')); } catch (e) { return erro(res, 'Falha ao gerar o Foundry .json: ' + e.message, 500); }
  }

  // importação: .dnd4e (Character Builder), .json (ficha do app) e PDF editável (campos de formulário)
  if (p === '/api/importar' && req.method === 'POST') {
    const d = await json(req);
    const buf = Buffer.from(String(d.base64 || ''), 'base64');
    const nome = String(d.nome || '').toLowerCase();
    let ficha, info = {};
    if (nome.endsWith('.dnd4e') || nome.endsWith('.xml')) {
      ficha = imp.lerDnd4e(buf.toString('utf8'));
    } else if (nome.endsWith('.json')) {
      ficha = JSON.parse(buf.toString('utf8'));
      if (!ficha || !ficha.nome) return erro(res, 'Arquivo .json não parece uma ficha deste app.');
      ficha.id = imp.novoId();
    } else if (nome.endsWith('.pdf')) {
      const r = await pdf.lerPdfEditavel(buf);
      ficha = r.ficha; ficha.id = imp.novoId(); info = { origem: r.origem };
    } else return erro(res, 'Use um arquivo .pdf (editável), .dnd4e ou .json.');
    const igual = listarPersonagens().find((x) => x.tipo !== 'criatura' && String(x.nome).trim().toLowerCase() === String(ficha.nome).trim().toLowerCase());
    if (igual && !d.acao) return ok(res, { conflito: { id: igual.id, nome: igual.nome, notas: igual.notas } });
    if (igual && d.acao === 'atualizar') {
      const ant = JSON.parse(fs.readFileSync(arqPers(igual.id), 'utf8'));
      ficha.id = igual.id;
      const titulos = new Set((ficha.notas || []).map((n) => n.titulo + '|' + n.texto));
      ficha.notas = [...(ant.notas || []), ...(ficha.notas || []).filter((n) => !(ant.notas || []).some((a) => a.titulo + '|' + a.texto === n.titulo + '|' + n.texto))];
      ficha.retrato = ficha.retrato || ant.retrato;
      ficha.criado = ant.criado || ficha.criado;
    }
    salvarPersonagem(ficha);
    return ok(res, { ficha, info });
  }

  // atualizações pelos Releases do GitHub
  if (p === '/api/versao') return ok(res, await atualizador.verificar(q.forcar === '1'));
  if (p === '/api/atualizar' && req.method === 'POST') {
    try { const v = await atualizador.instalar(); ok(res, { ok: true, versao: v.versao }); }
    catch (e) { erro(res, e.message, 500); }
    return;
  }

  erro(res, 'Rota não encontrada.', 404);
}

const servidor = http.createServer(async (req, res) => {
  try { await rota(req, res); } catch (e) { console.error(e); if (!res.headersSent) erro(res, e.message || 'Erro interno.', 500); else res.end(); }
});
// o app desktop espera por isto antes de abrir a janela (e mostra o erro se a porta estiver ocupada)
export const pronto = new Promise((resolve, reject) => {
  servidor.once('error', reject);
  servidor.listen(PORTA, '127.0.0.1', () => { console.log(`Grimório do Aventureiro: http://localhost:${PORTA}`); resolve(PORTA); });
});

