// PDF editável da ficha: exporta com campos de formulário (preenchíveis em qualquer leitor de PDF) e importa lendo os campos.
// Sem IA e sem login. O PDF exportado leva a ficha completa embutida (para voltar exatamente como estava);
// os campos editáveis do PDF prevalecem sobre ela. PDFs de outras fontes só são aceitos se tiverem campos reconhecíveis.
import zlib from 'node:zlib';
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFDict, PDFHexString } from 'pdf-lib';
import { calcular, PERICIAS as PER_EN } from './calculo.mjs';
import { nomePT, acharPorNome } from './compendio.mjs';
import { novoPersonagem, novoId } from './importar.mjs';

const ATR = [['for', 'FOR', 'Força'], ['con', 'CON', 'Constituição'], ['des', 'DES', 'Destreza'], ['int', 'INT', 'Inteligência'], ['sab', 'SAB', 'Sabedoria'], ['car', 'CAR', 'Carisma']];
const PT_PER = { Acrobatics: 'Acrobacia', Arcana: 'Arcanismo', Athletics: 'Atletismo', Bluff: 'Blefar', Diplomacy: 'Diplomacia', Dungeoneering: 'Exploração', Endurance: 'Resistência', Heal: 'Cura', History: 'História', Insight: 'Intuição', Intimidate: 'Intimidação', Nature: 'Natureza', Perception: 'Percepção', Religion: 'Religião', Stealth: 'Furtividade', Streetwise: 'Manha', Thievery: 'Ladinagem' };
const CHAVE_INFO = 'Ficha4e';

// Fontes padrão do PDF só aceitam WinAnsi: troca o que não existir nela.
const limpa = (s) => String(s ?? '').normalize('NFC').replace(/[✦◆►]/g, '*').replace(/[^\n\r -~ -ÿ–—‘’“”•…]/g, '?').replace(/\r/g, '');
const sinal = (n) => (n >= 0 ? '+' : '') + n;
const nomeBi = (cat, nome) => { const pt = nomePT(nome); return pt && pt.toLowerCase() !== String(nome).toLowerCase() ? `${nome} (${pt})` : nome; };

const A4 = [595.28, 841.89];
const COR = { tinta: rgb(0.17, 0.1, 0.05), sangue: rgb(0.56, 0.1, 0.1), ouro: rgb(0.72, 0.53, 0.1), perg: rgb(0.97, 0.93, 0.8), campo: rgb(1, 0.99, 0.94), cinza: rgb(0.94, 0.9, 0.8) };

export async function gerarPdf(P) {
  const c = calcular(P);
  const doc = await PDFDocument.create();
  const form = doc.getForm();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(limpa(`Ficha de ${P.nome}`)); doc.setCreator('Grimório do Aventureiro'); doc.setProducer('Grimório do Aventureiro');

  let pag = null;
  const nova = (titulo) => {
    pag = doc.addPage(A4);
    pag.drawRectangle({ x: 0, y: A4[1] - 46, width: A4[0], height: 46, color: COR.tinta });
    pag.drawRectangle({ x: 0, y: A4[1] - 49, width: A4[0], height: 3, color: COR.ouro });
    pag.drawText('FICHA DE PERSONAGEM  ·  D&D 4ª EDIÇÃO', { x: 36, y: A4[1] - 30, size: 15, font: negrito, color: rgb(0.95, 0.85, 0.5) });
    pag.drawText(limpa(titulo || P.nome), { x: A4[0] - 36 - negrito.widthOfTextAtSize(limpa(titulo || P.nome), 11), y: A4[1] - 29, size: 11, font: negrito, color: rgb(0.95, 0.9, 0.75) });
    return pag;
  };
  const Y = (topo, h = 0) => A4[1] - topo - h; // y medido do topo da página
  const rotulo = (txt, x, topo, size = 6.5) => pag.drawText(limpa(txt).toUpperCase(), { x, y: Y(topo, 0), size, font: negrito, color: COR.sangue });
  const secao = (txt, x, topo, w) => {
    pag.drawText(limpa(txt).toUpperCase(), { x, y: Y(topo, 9), size: 9.5, font: negrito, color: COR.sangue });
    pag.drawLine({ start: { x, y: Y(topo, 12) }, end: { x: x + w, y: Y(topo, 12) }, thickness: 1.2, color: COR.tinta });
  };
  const campo = (nome, x, topo, w, h, valor, o = {}) => {
    const t = form.createTextField(nome);
    if (o.multi) t.enableMultiline();
    t.setText(limpa(valor));
    t.addToPage(pag, { x, y: Y(topo, h), width: w, height: h, font: fonte, textColor: COR.tinta, borderColor: COR.tinta, borderWidth: 0.6, backgroundColor: o.ro ? COR.cinza : COR.campo });
    if (o.size) t.setFontSize(o.size);
    if (o.center) t.setAlignment(1);
    if (o.ro) t.enableReadOnly();
    return t;
  };
  const marca = (nome, x, topo, tam, marcado) => {
    const k = form.createCheckBox(nome);
    k.addToPage(pag, { x, y: Y(topo, tam), width: tam, height: tam, borderColor: COR.tinta, borderWidth: 0.6, backgroundColor: COR.campo });
    if (marcado) k.check();
    return k;
  };
  const cx = (nome, rot, x, topo, w, valor, o = {}) => { rotulo(rot, x, topo - 1); return campo(nome, x, topo + 2, w, o.h || 17, valor, { size: 9, ...o }); };

  // ------------------------------------------------ página 1
  nova(P.nome);
  const cls = /^hybrid/i.test(P.classe?.nome || '') ? 'Híbrido: ' + (P.extras || []).filter((e) => /^ID_FMP_HYBRID_CLASS_/.test(e.id)).map((e) => e.nome.replace(/^Hybrid\s+/i, '')).join(' + ') : P.classe?.nome ? nomeBi('class', P.classe.nome) : '', rac = P.raca?.nome ? nomeBi('race', P.raca.nome) : '';
  cx('nome', 'Nome do personagem', 36, 66, 215, P.nome, { size: 11 });
  cx('jogador', 'Jogador', 258, 66, 130, P.jogador);
  cx('nivel', 'Nível', 395, 66, 34, P.nivel, { center: true });
  cx('xp', 'XP', 436, 66, 60, P.xp);
  cx('ouro', 'Ouro (po)', 503, 66, 56, P.ouro ?? 0, { center: true });
  cx('raca', 'Raça', 36, 92, 130, rac, { ro: true }); cx('classe', 'Classe', 172, 92, 130, cls, { ro: true });
  cx('paragon', 'Trilha exemplar', 308, 92, 125, P.paragon?.nome ? nomeBi('paragonpath', P.paragon.nome) : '', { ro: true });
  cx('destino', 'Destino épico', 439, 92, 120, P.destino?.nome ? nomeBi('epicdestiny', P.destino.nome) : '', { ro: true });
  cx('tema', 'Tema', 36, 118, 130, P.tema?.nome ? nomeBi('theme', P.tema.nome) : '', { ro: true });
  cx('antecedente', 'Antecedente', 172, 118, 130, P.antecedente?.nome ? nomeBi('background', P.antecedente.nome) : '', { ro: true });
  cx('divindade', 'Divindade', 308, 118, 125, P.divindade?.nome ? nomeBi('deity', P.divindade.nome) : '', { ro: true });
  cx('tendencia', 'Tendência', 439, 118, 120, P.tendencia);
  cx('tamanho', 'Tamanho', 36, 144, 70, P.tamanho); cx('genero', 'Gênero', 112, 144, 70, P.genero); cx('idade', 'Idade', 188, 144, 50, P.idade);
  cx('altura', 'Altura', 244, 144, 60, P.altura); cx('peso', 'Peso', 310, 144, 60, P.peso); cx('idiomas', 'Idiomas', 376, 144, 183, P.idiomas, { size: 8 });

  // atributos
  secao('Atributos', 36, 176, 262);
  ['', 'Base', 'Raça', 'Níveis', 'Final', 'Mod.'].forEach((t, i) => pag.drawText(t.toUpperCase(), { x: [36, 80, 122, 164, 206, 248][i], y: Y(194), size: 6.5, font: negrito, color: COR.tinta }));
  ATR.forEach(([k, s, n], i) => {
    const top = 198 + i * 24;
    pag.drawText(s, { x: 36, y: Y(top, 14), size: 10, font: negrito, color: COR.tinta });
    campo('atr_base_' + k, 76, top, 34, 18, P.atr?.base?.[k] ?? 10, { center: true, size: 10 });
    campo('atr_racial_' + k, 118, top, 34, 18, P.atr?.racial?.[k] ?? 0, { center: true, size: 10 });
    campo('calc_niv_' + k, 160, top, 34, 18, sinal(c.detalheAtributos[k].niveis), { center: true, ro: true });
    campo('calc_atr_' + k, 202, top, 34, 18, c.atributos[k], { center: true, ro: true, size: 11 });
    campo('calc_mod_' + k, 244, top, 34, 18, sinal(c.modificadores[k]), { center: true, ro: true, size: 11 });
  });
  pag.drawText('Níveis 11 e 21: +1 em todos, automático.', { x: 36, y: Y(346), size: 6.5, font: fonte, color: COR.tinta });

  // defesas e vida
  secao('Defesas e vida', 318, 176, 241);
  [['CA', c.ac], ['FORT', c.fort], ['REF', c.ref], ['VONT', c.vont]].forEach(([n, v], i) => {
    const x = 318 + i * 62;
    pag.drawText(n, { x: x + 26 - negrito.widthOfTextAtSize(n, 8) / 2, y: Y(204), size: 8, font: negrito, color: COR.sangue });
    campo('calc_' + n.toLowerCase(), x + 4, 208, 44, 30, v, { center: true, ro: true, size: 16 });
  });
  const linha2 = [['pv', 'PV máx.', c.pv, true], ['pv_atual', 'PV atuais', P.pvAtual ?? c.pv, false], ['surtos', 'Pulsos/dia', c.surtos, true], ['surtos_atual', 'Pulsos atuais', P.surtosAtuais ?? c.surtos, false]];
  linha2.forEach(([n, r, v, ro], i) => cx((ro ? 'calc_' : '') + n, r, 318 + i * 62, 254, 54, v, { center: true, ro, size: 11 }));
  [['vel', 'Velocidade', c.velocidade], ['ini', 'Iniciativa', sinal(c.iniciativa)], ['valorsurto', 'Valor do pulso', c.valorSurto], ['machucado', 'Sangrando em', Math.floor(c.pv / 2)]]
    .forEach(([n, r, v], i) => cx('calc_' + n, r, 318 + i * 62, 292, 54, v, { center: true, ro: true, size: 11 }));
  pag.drawText(limpa(`Armadura: penalidade ${c.penalidadeArmadura}`), { x: 318, y: Y(332), size: 7, font: fonte, color: COR.tinta });

  // perícias
  secao('Perícias  (marque ☑ se treinada; "+" = bônus extra)'.replace('☑', 'x'), 36, 358, 523);
  PER_EN.forEach(([n, ab], i) => {
    const col = i < 9 ? 0 : 1, lin = i < 9 ? i : i - 9;
    const x = 36 + col * 268, top = 376 + lin * 21;
    campo('calc_per_' + n, x, top, 28, 16, sinal(c.pericias[n]), { center: true, ro: true, size: 9 });
    pag.drawText(limpa(`${PT_PER[n]} (${ab.toUpperCase()})`), { x: x + 34, y: Y(top, 11), size: 9, font: fonte, color: COR.tinta });
    marca('per_trein_' + n, x + 170, top + 2, 11, !!P.pericias?.[n]?.treinada);
    campo('per_extra_' + n, x + 190, top, 28, 16, P.pericias?.[n]?.extra || 0, { center: true, size: 9 });
  });
  secao('Ataques das armas equipadas', 36, 578, 523);
  const atq = c.ataques.map((a) => `${a.nome}: ataque ${sinal(a.ataque)} (${a.atributo.toUpperCase()}), dano ${a.dano}${a.danoBonus ? sinal(a.danoBonus) : ''}`).join('\n') || 'Nenhuma arma equipada.';
  campo('calc_ataques', 36, 596, 523, 50, atq, { multi: true, ro: true, size: 8.5 });
  secao('Talentos', 36, 658, 523);
  campo('calc_talentos', 36, 676, 523, 130, (P.talentos || []).map((t) => '• ' + nomeBi('feat', t.nome)).join('\n'), { multi: true, ro: true, size: 8.5 });
  if (c.avisos.length) pag.drawText(limpa('Avisos: ' + c.avisos.join(' | ')).slice(0, 150), { x: 36, y: 30, size: 6.5, font: fonte, color: COR.sangue });

  // ------------------------------------------------ página 2: poderes, itens, texto
  nova(P.nome + ' — poderes e itens');
  secao('Poderes', 36, 66, 523);
  const GR = [['atwill', 'Sem limite'], ['encounter', 'Encontro'], ['daily', 'Diários'], ['outro', 'Outros']];
  const grupo = (w) => { const t = (w.tipo || '').toLowerCase(); return /at-?will/.test(t) ? 'atwill' : /enc/.test(t) ? 'encounter' : /daily/.test(t) ? 'daily' : 'outro'; };
  const txtPod = GR.map(([g, n]) => {
    const l = (P.poderes || []).filter((w) => grupo(w) === g).sort((a, b) => (+a.nivel || 0) - (+b.nivel || 0));
    return l.length ? `${n.toUpperCase()}\n` + l.map((w) => `  • ${nomeBi('power', w.nome)}${w.nivel ? '  (nív. ' + w.nivel + ')' : ''}`).join('\n') : '';
  }).filter(Boolean).join('\n\n');
  campo('calc_poderes', 36, 84, 523, 250, txtPod || 'Nenhum poder.', { multi: true, ro: true, size: 8.5 });
  secao('Inventário  (☑ = equipado: bônus entram nos cálculos ao importar de volta no app)'.replace('☑', 'x'), 36, 346, 523);
  let top = 366, linhas = 0;
  const itens = P.itens || [];
  for (const it of itens) {
    if (top > 790) { nova(P.nome + ' — inventário'); top = 70; }
    const nome = it.base && it.ench ? `${it.base.nome} · ${it.ench.nome}${it.ench.mais ? ' +' + it.ench.mais : ''}` : it.cat === 'item' && it.variante?.mais ? `${it.nome} +${it.variante.mais}` : it.nome;
    marca('item_eq_' + it.id, 36, top + 2, 12, !!it.equipado);
    campo('item_nome_' + it.id, 54, top, 440, 16, `${nome}${it.qtd > 1 ? '  x' + it.qtd : ''}`, { ro: true, size: 8.5 });
    campo('item_qtd_' + it.id, 500, top, 59, 16, it.qtd ?? 1, { center: true, size: 9 });
    top += 20; linhas++;
  }
  if (!itens.length) pag.drawText('Mochila vazia.', { x: 36, y: Y(top + 10), size: 9, font: fonte, color: COR.tinta });

  nova(P.nome + ' — personalidade');
  let t2 = 66;
  for (const [k, r, h] of [['tracos', 'Traços', 120], ['aparencia', 'Aparência', 90], ['companheiros', 'Companheiros', 90]]) {
    secao(r, 36, t2, 523); campo(k, 36, t2 + 18, 523, h, P[k] || '', { multi: true, size: 9 }); t2 += h + 34;
  }

  // ------------------------------------------------ anotações (uma janela do app = um bloco)
  const notas = P.notas || [];
  for (let i = 0; i < notas.length; i += 2) {
    nova(P.nome + ' — anotações');
    notas.slice(i, i + 2).forEach((n, j) => {
      const topo = 66 + j * 350;
      rotulo('Anotação', 36, topo);
      campo('nota_t_' + n.id, 36, topo + 4, 523, 18, n.titulo, { size: 11 });
      campo('nota_x_' + n.id, 36, topo + 26, 523, 290, n.texto || '', { multi: true, size: 9 });
    });
  }

  // ficha completa embutida (sem retrato pesado), para importar de volta sem perder nada
  const copia = { ...P, retrato: P.retrato && P.retrato.length < 60000 ? P.retrato : null };
  const blob = zlib.gzipSync(Buffer.from(JSON.stringify(copia), 'utf8')).toString('base64');
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  info.set(PDFName.of(CHAVE_INFO), PDFString.of(blob));
  form.updateFieldAppearances(fonte);
  return Buffer.from(await doc.save());
}

// ------------------------------------------------ importação
function camposDoPdf(form) {
  const o = {};
  for (const f of form.getFields()) {
    const n = f.getName();
    const tipo = f.constructor.name;
    try {
      if (tipo === 'PDFCheckBox') o[n] = f.isChecked();
      else if (tipo === 'PDFTextField') o[n] = f.getText() ?? '';
      else if (tipo === 'PDFDropdown' || tipo === 'PDFOptionList') o[n] = (f.getSelected() || [])[0] ?? '';
    } catch { /* campo ilegível */ }
  }
  return o;
}
const numero = (v, d = 0) => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : d; };

export const MSG_INCOMPATIVEL = 'Este PDF não é compatível com o programa: ele não tem campos de formulário que eu consiga ler (parece ser só uma imagem ou texto fixo). Use o PDF exportado por este app, um arquivo .dnd4e do Character Builder ou o .json exportado.';

export async function lerPdfEditavel(buffer) {
  let doc;
  try { doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false }); } catch { throw new Error('Não consegui abrir este arquivo como PDF.'); }
  const form = doc.getForm();
  const campos = camposDoPdf(form);
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  const guardada = info?.get(PDFName.of(CHAVE_INFO));
  if (guardada) { // PDF exportado por este app
    const txt = guardada instanceof PDFString || guardada instanceof PDFHexString ? guardada.decodeText() : String(guardada);
    let P;
    try { P = JSON.parse(zlib.gunzipSync(Buffer.from(txt, 'base64')).toString('utf8')); } catch { throw new Error(MSG_INCOMPATIVEL); }
    aplicarCampos(P, campos);
    return { ficha: P, origem: 'app' };
  }
  if (!Object.keys(campos).length) throw new Error(MSG_INCOMPATIVEL);
  const P = fichaDeCamposGenericos(campos);
  if (!P) throw new Error(MSG_INCOMPATIVEL);
  return { ficha: P, origem: 'campos' };
}

// o que o jogador pode ter editado no PDF volta para a ficha
function aplicarCampos(P, v) {
  const t = (k) => (k in v ? v[k] : undefined);
  for (const k of ['nome', 'jogador', 'tendencia', 'tamanho', 'genero', 'idade', 'altura', 'peso', 'idiomas', 'tracos', 'aparencia', 'companheiros']) if (t(k) !== undefined) P[k] = String(t(k));
  if (t('nivel') !== undefined) P.nivel = Math.max(1, Math.min(30, numero(t('nivel'), P.nivel)));
  if (t('xp') !== undefined) P.xp = numero(t('xp'), P.xp);
  if (t('ouro') !== undefined) P.ouro = numero(t('ouro'), P.ouro);
  if (t('pv_atual') !== undefined) P.pvAtual = numero(t('pv_atual'), P.pvAtual);
  if (t('surtos_atual') !== undefined) P.surtosAtuais = numero(t('surtos_atual'), P.surtosAtuais);
  P.atr = P.atr || { base: {}, racial: {}, aumentos: {} };
  for (const [k] of ATR) {
    if (t('atr_base_' + k) !== undefined) P.atr.base[k] = numero(t('atr_base_' + k), P.atr.base[k]);
    if (t('atr_racial_' + k) !== undefined) P.atr.racial[k] = numero(t('atr_racial_' + k), P.atr.racial[k]);
  }
  P.pericias = P.pericias || {};
  for (const [n] of PER_EN) {
    P.pericias[n] = P.pericias[n] || { treinada: false, extra: 0 };
    if (t('per_trein_' + n) !== undefined) P.pericias[n].treinada = !!t('per_trein_' + n);
    if (t('per_extra_' + n) !== undefined) P.pericias[n].extra = numero(t('per_extra_' + n), 0);
  }
  for (const it of P.itens || []) {
    if (t('item_eq_' + it.id) !== undefined) it.equipado = !!t('item_eq_' + it.id);
    if (t('item_qtd_' + it.id) !== undefined) it.qtd = numero(t('item_qtd_' + it.id), it.qtd ?? 1);
  }
  for (const n of P.notas || []) {
    if (t('nota_t_' + n.id) !== undefined && v['nota_t_' + n.id] !== n.titulo) { n.titulo = String(v['nota_t_' + n.id]); n.editado = new Date().toISOString(); }
    if (t('nota_x_' + n.id) !== undefined && v['nota_x_' + n.id] !== (n.texto || '')) { n.texto = String(v['nota_x_' + n.id]); n.editado = new Date().toISOString(); }
  }
  P.historico = P.historico || [];
  P.historico.push({ quando: new Date().toISOString(), tipo: 'importacao', texto: 'Importado de PDF editável.' });
}

// PDFs de outras fontes com campos de formulário (ex.: ficha 4e preenchível): reconhece os nomes mais comuns
function fichaDeCamposGenericos(v) {
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const m = {}; for (const [k, val] of Object.entries(v)) m[norm(k)] = val;
  const pega = (...nomes) => { for (const n of nomes) { for (const [k, val] of Object.entries(m)) if (k === n && val !== '' && val !== false) return val; } return undefined; };
  const a = {
    for: pega('str', 'strength', 'for', 'forca', 'strscore', 'strengthscore'), con: pega('con', 'constitution', 'constituicao', 'conscore'),
    des: pega('dex', 'dexterity', 'des', 'destreza', 'dexscore'), int: pega('int', 'intelligence', 'inteligencia', 'intscore'),
    sab: pega('wis', 'wisdom', 'sab', 'sabedoria', 'wisscore'), car: pega('cha', 'charisma', 'car', 'carisma', 'chascore'),
  };
  const nome = pega('charactername', 'name', 'nome', 'nomedopersonagem', 'personagem');
  const reconhecidos = [nome, ...Object.values(a)].filter((x) => x !== undefined).length;
  if (reconhecidos < 3) return null;
  const nivel = Math.max(1, numero(pega('level', 'nivel', 'charlevel'), 1));
  const tier = (nivel >= 11 ? 1 : 0) + (nivel >= 21 ? 1 : 0);
  const classe = pega('class', 'classe'), raca = pega('race', 'raca');
  const P = novoPersonagem({
    nome: String(nome || 'Importado do PDF'), jogador: String(pega('playername', 'player', 'jogador') || ''), nivel, xp: numero(pega('xp', 'totalxp', 'experience', 'experiencia'), 0),
    tendencia: String(pega('alignment', 'tendencia') || ''), tamanho: String(pega('size', 'tamanho') || ''), genero: String(pega('gender', 'genero') || ''),
    idade: String(pega('age', 'idade') || ''), altura: String(pega('height', 'altura') || ''), peso: String(pega('weight', 'peso') || ''),
    classe: classe ? refPorNome('class', classe) : null, raca: raca ? refPorNome('race', raca) : null,
    paragon: pega('paragonpath', 'paragon') ? refPorNome('paragonpath', pega('paragonpath', 'paragon')) : null,
    destino: pega('epicdestiny', 'destino') ? refPorNome('epicdestiny', pega('epicdestiny', 'destino')) : null,
  });
  P.atr = { base: Object.fromEntries(Object.entries(a).map(([k, x]) => [k, numero(x, 10) - tier])), racial: {}, aumentos: {} };
  P.pv = numero(pega('maxhp', 'hp', 'hitpoints', 'pv'), 0); P.pvAtual = P.pv;
  P.surtos = numero(pega('surgesday', 'healingsurges', 'surtos'), 0); P.surtosAtuais = P.surtos;
  P.pericias = Object.fromEntries(PER_EN.map(([n]) => [n, { treinada: false, extra: 0 }]));
  // o que o PDF diz sobre defesas/PV vira ajuste, para o total bater com a ficha original
  try {
    const c = calcular(P); const aj = {};
    for (const [k, a1, b1] of [['ca', pega('ac', 'armorclass', 'ca'), c.ac], ['fort', pega('fortitude', 'fort', 'fortdef'), c.fort], ['ref', pega('reflex', 'ref', 'refdef'), c.ref], ['vont', pega('will', 'vont', 'willdef'), c.vont], ['pv', P.pv, c.pv], ['surtos', P.surtos, c.surtos]]) {
      const x = numero(a1, NaN); if (Number.isFinite(x) && x && x - b1) aj[k] = x - b1;
    }
    if (Object.keys(aj).length) P.ajustes = aj;
  } catch { /* sem ajuste */ }
  P.historico.push({ quando: new Date().toISOString(), tipo: 'importacao', texto: 'Importado de PDF com campos de formulário.' });
  return P;
}
function refPorNome(cat, nome) {
  const e = acharPorNome(cat, String(nome).replace(/\s*\(.*\)\s*$/, ''));
  return e ? { cat, id: e.ID, nome: e.Name } : { cat, id: null, nome: String(nome) };
}
