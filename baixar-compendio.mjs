// Baixa o compêndio do iws.mx (4e Database) para a pasta compendio\ (uma vez; depois funciona offline).
// Uso: node baixar-compendio.mjs [categoria ...]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const destino = path.join(aqui, 'compendio');
const BASE = 'https://iws.mx/dnd/4e_database_files/';
const TODAS = ['class', 'power', 'race', 'feat', 'item', 'weapon', 'armor', 'implement', 'background', 'theme',
  'paragonpath', 'epicdestiny', 'deity', 'ritual', 'glossary', 'companion', 'disease', 'poison', 'monster', 'trap'];
const cats = process.argv.length > 2 ? process.argv.slice(2) : TODAS;
fs.mkdirSync(destino, { recursive: true });

async function baixar(url) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch {}
    await new Promise(r => setTimeout(r, 800 * (t + 1)));
  }
  return null;
}
// extrai o argumento JSON da chamada od.reader.xxx(versao, "cat", ...args)
// Os arquivos são JavaScript (aspas \' e vírgulas sobrando), então avaliamos num contexto vazio, sem acesso a nada.
function extrair(txt) {
  let args = null;
  const fn = (...a) => { args = a; };
  const ctx = vm.createContext({ od: { reader: new Proxy({}, { get: () => fn }) } });
  vm.runInContext(txt, ctx, { timeout: 20000 });
  return args;
}

for (const cat of cats) {
  const lt = await baixar(BASE + cat + '/_listing.js');
  if (!lt) { console.log(cat, 'sem listagem'); continue; }
  const [, , colunas, linhas] = extrair(lt);
  const dados = {};
  for (let n = 0; n < 20; n++) {
    const t = await baixar(BASE + cat + '/data' + n + '.js');
    if (!t) continue;
    const [, , obj] = extrair(t);
    Object.assign(dados, obj);
  }
  fs.writeFileSync(path.join(destino, cat + '.json'), JSON.stringify({ colunas, linhas, dados }));
  console.log(cat, linhas.length, 'itens,', Object.keys(dados).length, 'fichas HTML');
}
