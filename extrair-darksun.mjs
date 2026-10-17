// Converte o texto do Dark Sun Creature Catalog (pdftotext SEM -layout: ordem de leitura de coluna única,
// mais limpo que -layout nesse livro de 2 colunas) em criaturas no formato do app. Reconstrói HTML no
// mesmo padrão do iws.mx (h1/span/b/h2/p) e reusa lerMonstro() de criatura.mjs — não duplica a leitura do bloco.
// Uso: node extrair-darksun.mjs ["caminho.pdf"]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { lerMonstro } from './criatura.mjs';

const FUNCOES_RE = '(Artillery|Brute|Controller|Lurker|Skirmisher|Soldier)';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LABEL_RE = /^\s*(Attack|Hit|Miss|Effect|Trigger|Requirement|Special|Sustain(?: Minor| Move| Standard)?|Secondary Attack|Aftereffect|First Failed Saving Throw|Second Failed Saving Throw|Failed Saving Throw)\s*(\([^)]*\))?:\s*(.*)$/i;
const SECOES = ['TRAITS', 'STANDARD ACTIONS', 'MOVE ACTIONS', 'MINOR ACTIONS', 'TRIGGERED ACTIONS'];
const USO_KW = '(At-Will|Encounter|Daily|Recharge|Aura)';
const HP_RE = /^HP\s+([\d,]+)(?:;\s*Bloodied\s+(?:([\d,]+)|[^\n]*))?\.?$|^HP\s+1;\s*a missed attack never damages a minion\.$/m;
const LEVEL_RE = new RegExp(`^Level\\s+(\\d+)\\s+((?:Elite|Solo|Minion)\\s+)?${FUNCOES_RE}(\\s*\\(Leader\\))?\\s*$`, 'm');

const PDFTOTEXT = 'C:\\Users\\Gabriel\\AppData\\Local\\Microsoft\\WinGet\\Packages\\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\\poppler-25.07.0\\Library\\bin\\pdftotext.exe';

export function extrairTextoPdf(pdf, destino) {
  execFileSync(PDFTOTEXT, [pdf, destino]); // sem -layout: ordem de leitura de coluna única, mais limpo neste livro
}

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// ---- páginas com DUAS criaturas lado a lado: o pdftotext normal intercala as caixas de texto das duas colunas
// (cada seção/poder é uma caixa separada no InDesign original, a ordem delas no PDF não é "coluna inteira, depois
// a outra"). Aqui extraímos cada palavra com sua coordenada (-bbox-layout) e, só nas páginas onde isso acontece
// (as duas metades da página têm uma linha "HP N" cada — duas criaturas), reordenamos: todos os blocos da metade
// esquerda por altura (yMin), depois todos os da metade direita por altura. Páginas de 1 coluna ficam como estavam.
export function extrairTextoPdfBbox(pdf, destino) {
  execFileSync(PDFTOTEXT, ['-bbox-layout', pdf, destino]);
}

export function reordenarPorColuna(xml) {
  const paginas = [];
  for (const pg of xml.matchAll(/<page width="([\d.]+)"[^>]*>([\s\S]*?)<\/page>/g)) {
    const largura = +pg[1];
    const blocos = [];
    for (const bl of pg[2].matchAll(/<block xMin="([\d.]+)" yMin="([\d.]+)"[^>]*>([\s\S]*?)<\/block>/g)) {
      const linhas = [...bl[3].matchAll(/<line[^>]*>([\s\S]*?)<\/line>/g)].map((ln) =>
        decodeXml([...ln[1].matchAll(/<word[^>]*>([^<]*)<\/word>/g)].map((w) => w[1]).join(' ')));
      blocos.push({ x: +bl[1], y: +bl[2], texto: linhas.join('\n') });
    }
    const meio = largura / 2;
    const esquerda = blocos.filter((b) => b.x < meio), direita = blocos.filter((b) => b.x >= meio);
    const temHp = (lista) => lista.some((b) => /^HP\s+\d|^HP\s+1;/m.test(b.texto));
    let ordenados;
    if (temHp(esquerda) && temHp(direita)) { // página de 2 criaturas: reordena por coluna
      const porY = (a, b) => a.y - b.y || a.x - b.x;
      ordenados = [...esquerda.sort(porY), ...direita.sort(porY)];
    } else ordenados = blocos; // 1 coluna: mantém a ordem original do PDF (já funciona)
    paginas.push(ordenados.map((b) => b.texto).join('\n\n'));
  }
  return paginas.join('\n\f\n');
}

// ---- cabeçalho de um poder: "QCarrion Scent)Aura 10", "5Longspear (weapon))At-Will", ",Bite)At-Will (1/round)"
function lerCabecalhoPoder(linha) {
  const m = new RegExp(`^(.{0,3}?)([A-Za-z][A-Za-z0-9 '’-]{1,45}?)(?:\\s*\\(([^)]*)\\))?\\s*\\)\\s*${USO_KW}\\b\\s*(.*)$`).exec(linha);
  if (!m) return null;
  let nome = m[2].trim();
  if (/^[^A-Za-z\s]/.test(nome) || /^\d/.test(nome) || /^[A-Z][A-Z]/.test(nome)) nome = nome.slice(1).trim(); // ícone decorativo colado no nome
  if (!nome) return null;
  let usoTxt = m[4], extra = m[5].trim();
  if (usoTxt === 'At-Will' && /^\(?(\d+\/round)\)?$/.test(extra)) extra = extra.replace(/[()]/g, '');
  else if (usoTxt !== 'Aura') extra = '';
  return { nome, palavras: (m[3] || '').trim(), uso: usoTxt, extra };
}

export function lerPoderes(linhas) {
  const marcas = [];
  let secaoAtual = '';
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (SECOES.includes(l)) { secaoAtual = l; continue; }
    const cab = lerCabecalhoPoder(l);
    if (cab) marcas.push({ secao: secaoAtual, cab, linha: i });
  }
  const poderes = [];
  for (let k = 0; k < marcas.length; k++) {
    const { secao, cab, linha } = marcas[k];
    const fimCorpo = k + 1 < marcas.length ? marcas[k + 1].linha : linhas.length;
    const paragrafos = [];
    for (const raw of linhas.slice(linha + 1, fimCorpo)) {
      const l = raw.trim();
      if (!l) continue;
      const m = LABEL_RE.exec(l);
      if (m) paragrafos.push({ label: m[1], paren: m[2] ? m[2].slice(1, -1) : '', texto: m[3] });
      else if (paragrafos.length) paragrafos[paragrafos.length - 1].texto += ' ' + l;
    }
    const secaoH2 = secao === 'TRAITS' ? 'Traits' : secao === 'STANDARD ACTIONS' ? 'Standard Actions' : secao === 'MOVE ACTIONS' ? 'Move Actions' : secao === 'MINOR ACTIONS' ? 'Minor Actions' : secao === 'TRIGGERED ACTIONS' ? 'Triggered Actions' : '';
    const dirHtml = `<b>${esc(cab.uso)}</b>${cab.extra ? ' ' + esc(cab.extra) : ''}`;
    const headerHtml = `<b>${esc(cab.nome)}</b>${cab.palavras ? ` (${esc(cab.palavras)})` : ''} \u2726 ${dirHtml}`;
    const corpoHtml = paragrafos.map((p) => `<p class=flavorIndent><i>${esc(p.label)}${p.paren ? ` (${esc(p.paren)})` : ''}:</i> ${esc(p.texto.trim())}</p>`).join('');
    poderes.push({ secaoH2, headerHtml, corpoHtml });
  }
  return poderes;
}

function montarHtml(cabeca, blocoTexto, linhas) {
  const { nome, nivel, grupo, role, leader, tipo, xp } = cabeca;
  const g = (re) => { const m = re.exec(blocoTexto); return m ? m[1].trim() : ''; };
  const hpM = HP_RE.exec(blocoTexto);
  const hp = hpM ? (hpM[1] || '1').replace(/,/g, '') : '0';
  const bloodied = hpM && hpM[2] ? hpM[2].replace(/,/g, '') : '';
  const ini = g(/^Initiative\s+([+-]?\d+)/m);
  const def = /^AC\s+(\d+),\s*Fortitude\s+(\d+),\s*Reflex\s+(\d+),?\s*Will\s+(\d+)/m.exec(blocoTexto) || [, '', '', '', ''];
  const perception = g(/^Perception\s+([+-]?\d+)/m);
  const speedM = /^Speed\s+([^\n]+)/m.exec(blocoTexto);
  const speed = speedM ? speedM[1].trim() : '6';
  const visaoM = /^(Low-light vision|Darkvision|Tremorsense \d+|Blindsight \d+)\s*$/m.exec(blocoTexto);
  const sentidos = `Perception ${/^[+-]/.test(perception) ? perception : '+' + (perception || '0')}${visaoM ? '; ' + visaoM[1] : ''}`;
  const resist = g(/^Resist\s+([^\n]+)/m);
  const vulner = g(/^Vulnerable\s+([^\n]+)/m);
  const imune = g(/^Immune\s+([^\n]+)/m);
  const savingThrows = g(/^Saving Throws\s+\+?([^\n]+)/m);
  const actionPoints = g(/Action Points\s+(\d+)/);
  const skills = g(/^Skills\s+([^\n]+)/m);
  const atrM = /^Str\s+(\d+)\s*\(([+-]\d+)\)\s*$[\s\S]*?^Dex\s+(\d+)\s*\(([+-]\d+)\)\s*$[\s\S]*?^Wis\s+(\d+)\s*\(([+-]\d+)\)\s*$[\s\S]*?^Con\s+(\d+)\s*\(([+-]\d+)\)\s*$[\s\S]*?^Int\s+(\d+)\s*\(([+-]\d+)\)\s*$[\s\S]*?^Cha\s+(\d+)\s*\(([+-]\d+)\)\s*$/m.exec(blocoTexto);
  const align = g(/^Alignment\s+([^\n]+)/m);
  const lang = g(/^Languages\s+([^\n]+)/m);
  const equip = g(/^Equipment\s+([^\n]+)/m);

  const partes = [];
  partes.push(`<h1>${esc(nome)}</h1>`);
  partes.push(`<span class=type>${esc(tipo)}</span>`);
  const resto = `${grupo !== 'Standard' ? grupo + ' ' : ''}${role}${leader ? ' (Leader)' : ''}`;
  partes.push(`<span class=level>Level ${nivel} ${esc(resto)}<span class=xp>XP ${esc(xp)}</span></span>`);
  partes.push(`<b>HP</b> ${hp}${bloodied ? ` <b>Bloodied</b> ${bloodied}` : ''}`);
  partes.push(`<b>Initiative</b> ${ini || '+0'}`);
  partes.push(`<b>AC</b> ${def[1] || 0} <b>Fortitude</b> ${def[2] || 0} <b>Reflex</b> ${def[3] || 0} <b>Will</b> ${def[4] || 0}`);
  partes.push(`<b>Senses</b> ${esc(sentidos)}`);
  partes.push(`<b>Speed</b> ${esc(speed)}`);
  if (resist) partes.push(`<b>Resist</b> ${esc(resist)}`);
  if (vulner) partes.push(`<b>Vulnerable</b> ${esc(vulner)}`);
  if (imune) partes.push(`<b>Immune</b> ${esc(imune)}`);
  if (savingThrows) partes.push(`<b>Saving Throws</b> +${esc(savingThrows)}`);
  if (actionPoints) partes.push(`<b>Action Points</b> ${esc(actionPoints)}`);
  if (atrM) {
    partes.push(`<b>Str</b> ${atrM[1]} <b>Dex</b> ${atrM[3]} <b>Wis</b> ${atrM[5]}`);
    partes.push(`<b>Con</b> ${atrM[7]} <b>Int</b> ${atrM[9]} <b>Cha</b> ${atrM[11]}`);
  }
  if (skills) partes.push(`<b>Skills</b> ${esc(skills)}`);
  if (align) partes.push(`<b>Alignment</b> ${esc(align)}`);
  if (lang) partes.push(`<b>Languages</b> ${esc(lang)}`);
  if (equip) partes.push(`<b>Equipment</b> ${esc(equip)}`);

  let secaoAberta = '';
  for (const p of lerPoderes(linhas)) {
    if (p.secaoH2 && p.secaoH2 !== secaoAberta) { partes.push(`<h2>${p.secaoH2}</h2>`); secaoAberta = p.secaoH2; }
    partes.push(`<p class='flavor alt'>${p.headerHtml}</p>`);
    partes.push(p.corpoHtml);
  }
  return partes.join('\n');
}

const pareceNome = (s) => /^[A-Za-z][A-Za-z' -]{1,50}$/.test(s) && /[aeiouAEIOU]/.test(s);
const ehLinhaLevel = (s) => LEVEL_RE.test(s.trim());
const CAMPO_STAT_RE = /^(XP|Initiative|HP|AC|Speed|Perception|Senses|Resist|Vulnerable|Immune|Saving Throws|Action Points|Skills|Str|Dex|Wis|Con|Int|Cha|Alignment|Languages|Equipment)\b|^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/;

// ---- varre o texto inteiro: ancora em cada linha "HP N" (mais confiável que o cabeçalho, que às vezes
// sai corrompido pela fonte decorativa do nome grande da criatura — ver falhas de nome abaixo).
export function extrairCriaturas(texto) {
  // o PDF usa caracteres de controle invisíveis (ex. \u0003) como separador decorativo nos cabeçalhos de poder
  const linhas = texto.replace(/[\u0000-\u0008\u000B-\u001F]/g, '').split('\n');
  const ancoras = [];
  for (let i = 0; i < linhas.length; i++) if (/^HP\s+(\d+|1;\s*a missed)/.test(linhas[i].trim())) ancoras.push(i);
  // título da família (ex. "BAAZRAG", "CILOPS"): legenda de margem em letra maiúscula simples, decodificada
  // certo (ao contrário do nome grande estilizado da criatura, que pode saber corrompido pela fonte decorativa).
  // Mais confiável que usar o nome da criatura anterior como "família" quando o nome dela também veio corrompido.
  const bannerPorLinha = new Array(linhas.length).fill('');
  let bannerAtual = '';
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (/^[A-Z]{3,30}$/.test(l) && !SECOES.includes(l)) bannerAtual = l;
    bannerPorLinha[i] = bannerAtual;
  }
  let tituloFamilia = '';
  const resultado = [], falhas = [];
  for (let k = 0; k < ancoras.length; k++) {
    const iHp = ancoras[k];
    const iFim = k + 1 < ancoras.length ? ancoras[k + 1] - 2 : linhas.length; // -2: não incluir o nome/tipo do próximo bloco
    const blocoInicio = Math.max(0, iHp - 16); // folga: campos podem vir em qualquer ordem antes do HP (blocos reordenados por coluna)
    const blocoLinhas = linhas.slice(blocoInicio, iFim);
    const bloco = blocoLinhas.join('\n');
    const lv = LEVEL_RE.exec(bloco);
    if (!lv) { falhas.push({ nome: linhas[iHp - 2]?.trim() || '?', motivo: 'sem linha "Level N Papel" no bloco', linha: iHp }); continue; }
    let tipo = (linhas[iHp - 1] || '').trim();
    if (!/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/.test(tipo)) { // layout raro (solos épicos): tipo não fica logo acima do HP
      const tm = /^((?:Tiny|Small|Medium|Large|Huge|Gargantuan)\s+[A-Za-z, ()]+?)(?:\s+XP\s+[\d,]+)?\s*$/m.exec(bloco);
      tipo = tm ? tm[1].trim() : tipo;
    }
    // nome: a 1a linha não-vazia, não-"Level..." e não-campo de estatística, andando para trás a partir do HP
    let nome = '';
    for (let j = iHp - 1; j >= blocoInicio; j--) {
      const l = (linhas[j] || '').trim();
      if (!l || ehLinhaLevel(l) || CAMPO_STAT_RE.test(l)) continue;
      nome = l; break;
    }
    if (!pareceNome(nome)) {
      const familia = bannerPorLinha[iHp] || tituloFamilia;
      const familiaCap = familia ? familia[0] + familia.slice(1).toLowerCase() : '';
      nome = familiaCap ? `${familiaCap} (${lv[3]}${lv[4] ? ' Líder' : ''})` : `Criatura nível ${lv[1]} desconhecida`;
    } else tituloFamilia = nome.split(/\s+/)[0]; // 1a palavra do nome = família (Aarakocra, Braxat...), reserva se o banner também faltar
    const xp = (/^XP\s+([\d,]+)/m.exec(bloco) || [, ''])[1];
    const grupo = (lv[2] || '').trim() || 'Standard';
    const cabeca = { nome, nivel: +lv[1], grupo, role: lv[3], leader: !!lv[4], tipo: tipo || 'Medium natural humanoid', xp };
    try {
      const html = montarHtml(cabeca, bloco, blocoLinhas);
      const c = lerMonstro(html, { Name: nome, ID: '' });
      c.origem = { cat: 'monster', id: '', nome, fonte: 'Dark Sun Creature Catalog' };
      const ok = c.pv > 0 && c.ca > 0 && c.poderes.length > 0;
      if (ok) resultado.push(c); else falhas.push({ nome, motivo: `pv=${c.pv} ca=${c.ca} poderes=${c.poderes.length}`, linha: iHp });
    } catch (e) { falhas.push({ nome, motivo: String(e.message || e), linha: iHp }); }
  }
  return { resultado, falhas };
}

// ---- execução direta (só quando chamado como "node extrair-darksun.mjs", não quando importado)
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/extrair-darksun.mjs')) {
  const pdf = process.argv[2] || 'C:\\Users\\Gabriel\\Downloads\\Dark Sun Creature Catalog.pdf';
  const xmlPath = new URL('./_darksun-bbox.xml', import.meta.url).pathname.replace(/^\//, '').replace(/\//g, '\\');
  if (!fs.existsSync(xmlPath)) { console.log('Extraindo texto por coordenada (bbox)...'); extrairTextoPdfBbox(pdf, xmlPath); }
  const texto = reordenarPorColuna(fs.readFileSync(xmlPath, 'utf8'));
  const { resultado, falhas } = extrairCriaturas(texto);
  console.log(`Criaturas convertidas com sucesso: ${resultado.length}`);
  console.log(`Falhas: ${falhas.length}`);
  for (const f of falhas) console.log(' -', f.nome, '|', f.motivo);
  const semNome = resultado.filter((c) => /desconhecida|\(Líder\)|^[A-Za-zÀ-ú]+ \([A-Z]/.test(c.nome) || /^Criatura nível/.test(c.nome));
  console.log(`Nomes aproximados (fonte decorativa corrompeu o nome real): ${semNome.length}`);
  fs.writeFileSync(new URL('./_darksun-criaturas.json', import.meta.url), JSON.stringify(resultado, null, 1));
  console.log('Gravado em _darksun-criaturas.json');
}
