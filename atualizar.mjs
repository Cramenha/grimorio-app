// Verificação e instalação de atualizações pelos Releases do GitHub (só o dono do repositório publica).
// A pasta do app NÃO é substituída por inteiro: dados\ (fichas) e compendio\ nunca entram no pacote de atualização.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const REPO = 'Cramenha/grimorio-app';
const ASSET = /atualizacao.*\.zip$/i; // Grimorio-atualizacao-vX.Y.Z.zip (sem o runtime do Node)

const partes = (v) => String(v).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
export function maisNova(a, b) { // a > b ?
  const x = partes(a), y = partes(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

let cache = null;
export async function verificar(atual, forcar = false) {
  if (!forcar && cache && Date.now() - cache.quando < 60 * 60 * 1000) return { ...cache.r, atual };
  let r;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'grimorio-do-aventureiro', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) r = { ok: false, motivo: 'sem-release' }; // repositório privado ou ainda sem release
    else if (!res.ok) r = { ok: false, motivo: 'http-' + res.status };
    else {
      const j = await res.json();
      const asset = (j.assets || []).find((a) => ASSET.test(a.name));
      r = { ok: true, ultima: String(j.tag_name || '').replace(/^v/i, ''), notas: String(j.body || '').slice(0, 2000), pagina: j.html_url, zip: asset?.browser_download_url || null, tamanho: asset?.size || 0 };
      r.nova = !!r.zip && maisNova(r.ultima, atual);
    }
  } catch { r = { ok: false, motivo: 'sem-rede' }; }
  cache = { quando: Date.now(), r };
  return { ...r, atual };
}

// Baixa o zip, e entrega a troca de arquivos a um PowerShell separado que espera o servidor fechar (os arquivos em uso não podem ser trocados com ele aberto).
export async function instalar(pasta, atual) {
  const v = await verificar(atual, true);
  if (!v.ok || !v.nova) throw new Error('Não há atualização disponível.');
  const tmp = path.join(pasta, 'atualizacao');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const zip = path.join(tmp, 'novo.zip');
  const res = await fetch(v.zip, { headers: { 'User-Agent': 'grimorio-do-aventureiro' }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!res.ok) throw new Error('Falha ao baixar (' + res.status + ').');
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const exe = path.join(pasta, 'Grimorio.exe');
  const ps = path.join(tmp, 'aplicar.ps1');
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  fs.writeFileSync(ps, [
    `$ErrorActionPreference = 'Stop'`,
    `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue`,
    `Start-Sleep -Seconds 2`,
    `Expand-Archive -LiteralPath ${q(zip)} -DestinationPath ${q(path.join(tmp, 'novo'))} -Force`,
    `Copy-Item -Path ${q(path.join(tmp, 'novo', '*'))} -Destination ${q(pasta)} -Recurse -Force`,
    `Remove-Item -LiteralPath ${q(tmp)} -Recurse -Force -ErrorAction SilentlyContinue`,
    fs.existsSync(exe) ? `Start-Process -FilePath ${q(exe)}` : `Start-Process -FilePath ${q(process.execPath)} -ArgumentList 'server.js' -WorkingDirectory ${q(pasta)} -WindowStyle Hidden`,
  ].join('\r\n'));
  spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps], { detached: true, stdio: 'ignore' }).unref();
  return { versao: v.ultima };
}
