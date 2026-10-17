// Monta o pacote do Grimório para Windows: Grimorio.exe (launcher com ícone na bandeja) + runtime\node.exe + app.
// Gera em dist\: Grimorio-Windows-vX.zip (completo, com o Node embutido) e Grimorio-atualizacao-vX.zip (só o app, usado pelo botão de atualizar).
// Uso: node construir-exe.mjs [--com-dados]   (--com-dados inclui compendio\; sem isso o app baixa o compêndio na primeira vez)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const versao = JSON.parse(fs.readFileSync(path.join(aqui, 'package.json'), 'utf8')).version;
const comDados = process.argv.includes('--com-dados');
const dist = path.join(aqui, 'dist');
const stage = path.join(dist, 'Grimorio');
const FERRAMENTAS = /^(extrair-|traduzir|revisar-|verificar-traducao|teste-|baixar-compendio|construir-exe|_)/; // ferramentas de quem mantém: ficam só no repositório
const cp = (de, para) => fs.cpSync(de, para, { recursive: true });

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

// 1) launcher
const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
execFileSync(csc, ['/nologo', '/codepage:65001', '/target:winexe', `/out:${path.join(stage, 'Grimorio.exe')}`, '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', path.join(aqui, 'launcher', 'Grimorio.cs')], { stdio: 'inherit' });

// 2) app (sem fichas, sem compêndio, sem runtime)
for (const f of fs.readdirSync(aqui)) {
  if (/\.(mjs|js|html|css|json|md)$/.test(f) && !FERRAMENTAS.test(f) && f !== 'package-lock.json') cp(path.join(aqui, f), path.join(stage, f));
}
cp(path.join(aqui, 'extensao-roll20'), path.join(stage, 'extensao-roll20'));
cp(path.join(aqui, 'baixar-compendio.mjs'), path.join(stage, 'baixar-compendio.mjs')); // o servidor usa para baixar o compêndio
cp(path.join(aqui, 'manual', 'Grimorio-do-Aventureiro-Manual.pdf'), path.join(stage, 'Grimorio-do-Aventureiro-Manual.pdf')); // manual do usuário, para compartilhar com o pacote
const pkg = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8')); delete pkg.devDependencies; fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(pkg, null, 2));
for (const m of ['pdf-lib', '@pdf-lib', 'pako', 'tslib', 'bootstrap', '@fontsource']) cp(path.join(aqui, 'node_modules', m), path.join(stage, 'node_modules', m));
fs.writeFileSync(path.join(stage, 'LEIA-ME.txt'), [
  'GRIMORIO DO AVENTUREIRO / ADVENTURER\'S GRIMOIRE  v' + versao, '',
  'PT: Dê dois cliques em Grimorio.exe. O navegador abre em http://localhost:3102 e um ícone fica na bandeja (clique direito > Sair).',
  '    Suas fichas ficam na pasta dados\\ (faça backup dela). O botão ↻ no topo verifica atualizações.',
  'EN: Double-click Grimorio.exe. Your browser opens at http://localhost:3102 and a tray icon appears (right-click > Quit).',
  '    Your sheets are stored in the dados\\ folder (back it up). The ↻ button at the top checks for updates.', ''].join('\r\n'));

// 3) pacote de atualização (sem runtime e sem dados)
const zip = (origem, destino) => execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${origem}\\*' -DestinationPath '${destino}' -CompressionLevel Optimal -Force`], { stdio: 'inherit' });
zip(stage, path.join(dist, `Grimorio-atualizacao-v${versao}.zip`));

// 4) pacote completo: + Node embutido (+ compêndio se pedido)
fs.mkdirSync(path.join(stage, 'runtime'), { recursive: true });
fs.copyFileSync(process.execPath, path.join(stage, 'runtime', 'node.exe'));
if (comDados) cp(path.join(aqui, 'compendio'), path.join(stage, 'compendio'));
zip(stage, path.join(dist, `Grimorio-Windows-v${versao}${comDados ? '-com-compendio' : ''}.zip`));
for (const f of fs.readdirSync(dist)) if (f.endsWith('.zip')) console.log(f, (fs.statSync(path.join(dist, f)).size / 1048576).toFixed(1) + ' MB');
