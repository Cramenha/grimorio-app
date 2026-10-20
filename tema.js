// Tema claro/escuro, carregado no <head> do app e do manual, antes de pintar, para a tela não piscar no tema errado.
// Vale, nesta ordem: ?tema= na URL (o PDF do manual sai sempre claro), a escolha salva pelo botão do topo, o tema do sistema.
const TEMAS = ['claro', 'escuro'];
const TEMA_URL = new URLSearchParams(location.search).get('tema');
function temaSalvo() { try { const t = localStorage.getItem('tema'); return TEMAS.includes(t) ? t : null; } catch { return null; } }
function temaDoSistema() { return matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'; }
function temaAtual() { return document.documentElement.dataset.tema; }
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  document.documentElement.dataset.bsTheme = tema === 'claro' ? 'light' : 'dark'; // Bootstrap
}
function escolherTema(tema) {
  try { localStorage.setItem('tema', tema); } catch { /* sem armazenamento: vale só nesta sessão */ }
  aplicarTema(tema);
}
aplicarTema(TEMAS.includes(TEMA_URL) ? TEMA_URL : temaSalvo() || temaDoSistema());
// o manual, aberto em outra janela, acompanha a troca feita pelo botão do app
addEventListener('storage', (e) => { if (e.key === 'tema' && !TEMAS.includes(TEMA_URL)) aplicarTema(temaSalvo() || temaDoSistema()); });
// sem escolha salva, acompanha o sistema se ele trocar de tema com o app aberto
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (!TEMAS.includes(TEMA_URL) && !temaSalvo()) aplicarTema(temaDoSistema());
});
