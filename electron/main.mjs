// Grimório do Aventureiro (desktop): roda o mesmo server.js dentro do Electron e mostra o app numa janela própria.
// Fichas em %APPDATA%\Grimório do Aventureiro\dados (fora da pasta de instalação e do OneDrive); compêndio em resources\compendio.
// Atualizações: electron-updater pelos Releases do GitHub (o botão ↻ do app chama grimorioAtualizador via /api/versao e /api/atualizar).
import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import updater from 'electron-updater';
import { maisNova } from '../atualizar.mjs';

const { autoUpdater } = updater;
const RAIZ = path.join(import.meta.dirname, '..');
const PORTA = 3103; // diferente do Grimorio.exe (3102), para os dois poderem coexistir
const URL_APP = `http://localhost:${PORTA}`;

if (!app.requestSingleInstanceLock()) app.quit();

const DADOS = path.join(app.getPath('userData'), 'dados');
process.env.GRIMORIO_DADOS = DADOS;
process.env.GRIMORIO_COMPENDIO = app.isPackaged ? path.join(process.resourcesPath, 'compendio') : path.join(RAIZ, 'compendio');
process.env.GRIMORIO_PORTA = String(PORTA);

autoUpdater.autoDownload = false;
let pendente = null;
globalThis.grimorioAtualizador = {
  async verificar() {
    const atual = app.getVersion();
    if (!app.isPackaged) return { ok: false, motivo: 'dev', atual };
    try {
      const r = await autoUpdater.checkForUpdates();
      const info = r?.updateInfo || {};
      const notas = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note).join('\n') : String(info.releaseNotes || '');
      pendente = info.version || null;
      return { ok: true, ultima: info.version, nova: !!info.version && maisNova(info.version, atual), notas: notas.replace(/<[^>]+>/g, '').slice(0, 2000), atual };
    } catch (e) {
      return { ok: false, motivo: /404|No published versions|Cannot find latest/i.test(e.message) ? 'sem-release' : 'sem-rede', atual };
    }
  },
  async instalar() {
    if (!pendente) throw new Error('Não há atualização disponível.');
    await autoUpdater.downloadUpdate();
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 600); // instala em silêncio e reabre o app
    return { versao: pendente };
  },
};

let janela = null;
function criarJanela() {
  janela = new BrowserWindow({ width: 1400, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#0b0a13', autoHideMenuBar: true, title: 'Grimório do Aventureiro', icon: path.join(RAIZ, 'build', 'icon.ico'), show: false });
  janela.once('ready-to-show', () => { janela.maximize(); janela.show(); });
  // janelas do próprio app (ficha em janela separada, impressão de criatura) abrem no Electron; links externos vão para o navegador
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith(URL_APP)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.loadURL(URL_APP);
}

function montarMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Arquivo', submenu: [
      { label: 'Abrir pasta das fichas', click: () => shell.openPath(DADOS) },
      { type: 'separator' },
      { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Exibir', submenu: [
      { role: 'reload', label: 'Recarregar' },
      { role: 'zoomIn', label: 'Aumentar zoom' }, { role: 'zoomOut', label: 'Diminuir zoom' }, { role: 'resetZoom', label: 'Zoom normal' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Tela cheia' },
      { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
    ] },
  ]));
}

app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  montarMenu();
  try {
    const { pronto } = await import(pathToFileURL(path.join(RAIZ, 'server.js')).href);
    await pronto;
  } catch (e) {
    dialog.showErrorBox('Grimório do Aventureiro', e.code === 'EADDRINUSE'
      ? `A porta ${PORTA} já está em uso. Feche outro Grimório aberto e tente de novo.`
      : 'Não foi possível iniciar o Grimório:\n' + (e.stack || e.message));
    return app.quit();
  }
  criarJanela();
});
