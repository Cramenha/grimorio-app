// Importação do .dnd4e do Character Builder (lido direto, sem IA) e modelos de ficha. O PDF editável fica em pdf-ficha.mjs.
import crypto from 'node:crypto';
import { acharPorNome, norm } from './compendio.mjs';
import { calcular, variantes } from './calculo.mjs';

export const PERICIAS = ['Acrobatics', 'Arcana', 'Athletics', 'Bluff', 'Diplomacy', 'Dungeoneering', 'Endurance', 'Heal', 'History',
  'Insight', 'Intimidate', 'Nature', 'Perception', 'Religion', 'Stealth', 'Streetwise', 'Thievery'];

export const novoId = () => crypto.randomBytes(6).toString('hex');

export function novoPersonagem(base = {}) {
  const agora = new Date().toISOString();
  return {
    id: novoId(), versao: 1, criado: agora, atualizado: agora,
    nome: 'Novo aventureiro', jogador: '', raca: null, classe: null, paragon: null, destino: null, tema: null, antecedente: null,
    divindade: null, nivel: 1, xp: 0, tendencia: '', tamanho: '', genero: '', idade: '', altura: '', peso: '', idiomas: '',
    atributos: { for: 10, con: 10, des: 10, int: 10, sab: 10, car: 10 },
    defesas: { ca: 10, fort: 10, ref: 10, vont: 10 },
    pv: 0, pvAtual: null, surtos: 0, surtosAtuais: null, velocidade: 6, iniciativaExtra: 0,
    pericias: {}, talentos: [], poderes: [], itens: [], dinheiro: '', tracos: '', aparencia: '', companheiros: '',
    notas: [], historico: [{ quando: agora, tipo: 'criacao', texto: 'Personagem criado.' }], retrato: null,
    ...base,
  };
}

const ent = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const tag = (x, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i').exec(x); return m ? ent(m[1]).trim() : ''; };

// "Agile Armor +5" -> { nome:'Agile Armor', mais:5 }; "Cloak (paragon tier)" -> { nome, nivel }
function semMais(n) {
  let nome = String(n).trim(), mais = 0, nivel;
  const a = /\s*\+(\d+)$/.exec(nome); if (a) { mais = +a[1]; nome = nome.slice(0, a.index); }
  const b = /\s*\((heroic|paragon|epic) tier\)$/i.exec(nome); if (b) { nivel = { heroic: 1, paragon: 11, epic: 21 }[b[1].toLowerCase()]; nome = nome.slice(0, b.index); }
  const c = /\s*\(level (\d+)\)$/i.exec(nome); if (c) { nivel = +c[1]; nome = nome.slice(0, c.index); }
  return { nome, mais, nivel };
}

function ref(cat, nome, ctx) {
  const e = acharPorNome(cat, nome, ctx);
  // talento com escolha: o CB grava "Weapon Proficiency (Waraxe)" e o nome do compêndio perde a escolha; mantém o do CB
  if (e && cat === 'feat' && /\([^)]+\)\s*$/.test(nome) && !/\(/.test(e.Name)) return { cat, id: e.ID, nome: ent(nome) };
  return e ? { cat, id: e.ID, nome: e.Name } : { cat, id: null, nome: ent(nome) };
}

// ------------------------------------------------------------ .dnd4e
export function lerDnd4e(texto) {
  const x = texto.replace(/^﻿/, '');
  if (!/<D20Character/.test(x)) throw new Error('Este arquivo não parece uma ficha do Character Builder (.dnd4e).');
  const det = tag(x, 'Details');
  const stats = {};
  // alguns arquivos trazem o nome só nos <alias>; registramos o name e todos os aliases
  for (const m of x.matchAll(/<Stat\b([^>]*)>([\s\S]*?)<\/Stat>/g)) {
    const v = /value="(-?\d+)"/.exec(m[1]);
    if (!v) continue;
    const nomes = [(/name="([^"]+)"/.exec(m[1]) || [])[1], ...[...m[2].matchAll(/<alias name="([^"]+)"/g)].map((a) => a[1])].filter(Boolean);
    for (const n of nomes) { const k = ent(n).toLowerCase(); if (!(k in stats)) stats[k] = +v[1]; }
  }
  const s = (k) => stats[k.toLowerCase()] ?? 0;
  // atributos: base + bônus racial + aumentos escolhidos a cada nível (o CB registra cada parcela com o nível em que entrou)
  const atr = { base: {}, racial: {}, aumentos: {} };
  for (const [k, en] of [['for', 'Strength'], ['con', 'Constitution'], ['des', 'Dexterity'], ['int', 'Intelligence'], ['sab', 'Wisdom'], ['car', 'Charisma']]) {
    // o bloco pode ter name="Strength" ou só <alias name="Strength" />
    const blk = new RegExp(`<Stat\\b[^>]*name="${en}"[^>]*>([\\s\\S]*?)</Stat>|<Stat\\b[^>]*>(\\s*<alias name="${en}"[\\s\\S]*?)</Stat>`).exec(x);
    const bl = blk ? (blk[1] || blk[2] || '') : '';
    atr.base[k] = 10; atr.racial[k] = 0;
    for (const sa of bl.matchAll(/<statadd\b([^>]*?)\/?>/g)) {
      const lv = /Level="(\d+)"/.exec(sa[1])?.[1], v = +(/value="(-?\d+)"/.exec(sa[1])?.[1] || 0);
      if (!lv) { atr.base[k] = v; continue; }
      if (+lv === 1) atr.racial[k] += v;
      else if ([4, 8, 14, 18, 24, 28].includes(+lv)) for (let i = 0; i < v; i++) (atr.aumentos[lv] = atr.aumentos[lv] || []).push(k);
    }
  }

  const tally = x.slice(x.indexOf('<RulesElementTally'), x.indexOf('</RulesElementTally>'));
  const els = {};
  for (const m of tally.matchAll(/<RulesElement name="([^"]*)" type="([^"]*)" internal-id="([^"]*)"/g)) {
    (els[m[2]] = els[m[2]] || []).push({ nome: ent(m[1]), id: m[3] });
  }
  const um = (t) => els[t]?.[0]?.nome;
  const classeNome = um('Class');
  const nivel = parseInt(tag(det, 'Level'), 10) || s('level') || 1;
  const ctx = { classe: classeNome, nivel };

  const p = novoPersonagem({
    nome: tag(det, 'name') || 'Importado', jogador: tag(det, 'Player'), nivel, xp: parseInt(tag(det, 'Experience'), 10) || 0,
    altura: tag(det, 'Height'), peso: tag(det, 'Weight'), genero: tag(det, 'Gender') || um('Gender') || '', idade: tag(det, 'Age'),
    tendencia: tag(det, 'Alignment') || um('Alignment') || '', tamanho: um('Size') || '',
    dinheiro: [tag(det, 'CarriedMoney') && 'Consigo: ' + tag(det, 'CarriedMoney'), tag(det, 'StoredMoney') && 'Guardado: ' + tag(det, 'StoredMoney')].filter(Boolean).join(' | '),
    tracos: tag(det, 'Traits'), aparencia: tag(det, 'Appearance'), companheiros: tag(det, 'Companions'),
    atributos: { for: s('Strength'), con: s('Constitution'), des: s('Dexterity'), int: s('Intelligence'), sab: s('Wisdom'), car: s('Charisma') },
    defesas: { ca: s('AC'), fort: s('Fortitude Defense'), ref: s('Reflex Defense'), vont: s('Will Defense') },
    pv: s('Hit Points'), surtos: s('Healing Surges'), velocidade: s('Speed') || 6,
    iniciativaExtra: s('Initiative Misc'),
    idiomas: (els.Language || []).map((l) => l.nome).join(', '),
    raca: um('Race') ? ref('race', um('Race')) : null,
    classe: classeNome ? ref('class', classeNome) : null,
    paragon: um('Paragon Path') ? ref('paragonpath', um('Paragon Path')) : null,
    destino: um('Epic Destiny') ? ref('epicdestiny', um('Epic Destiny')) : null,
    tema: um('Theme') ? ref('theme', um('Theme')) : null,
    antecedente: um('Background') ? ref('background', um('Background')) : null,
    divindade: um('Deity') ? ref('deity', um('Deity')) : null,
  });
  p.surtosAtuais = p.surtos; p.pvAtual = p.pv;

  p.pvAtual = p.pv;
  const treinadas = new Set((els['Skill Training'] || []).map((t) => t.nome));
  for (const per of PERICIAS) {
    p.pericias[per] = { treinada: treinadas.has(per) || s(per + ' Trained') > 0, extra: 0 };
  }
  p.cbPericias = Object.fromEntries(PERICIAS.map((per) => [per, s(per)]));
  p.talentos = (els.Feat || []).map((f) => ref('feat', f.nome));
  const basicos = new Set(['melee basic attack', 'ranged basic attack']);
  p.poderes = (els.Power || []).filter((w) => !basicos.has(norm(w.nome))).map((w) => {
    const e = acharPorNome('power', w.nome.replace(/\s*\[[^\]]*\]\s*$/, ''), ctx);
    return e ? { cat: 'power', id: e.ID, nome: e.Name, tipo: e.Type, nivel: e.Level, classe: e.ClassName }
      : { cat: 'power', id: null, nome: w.nome, tipo: '', nivel: '', classe: '' };
  });

  // inventário
  const iLoot = x.indexOf('<LootTally');
  const secLoot = iLoot >= 0 ? x.slice(iLoot, x.indexOf('</LootTally>', iLoot)) : '';
  // augment encaixado: o CB grava na arma o atributo augment="<CharLootID><baseID>ID_FMP_MAGIC_ITEM_n</baseID>…" e deixa o shard também solto na mochila
  const augDe = (attrs) => /<baseID>(ID_[A-Z_0-9]+)<\/baseID>/.exec(ent((/\baugment="([^"]*)"/.exec(attrs) || [])[1] || ''))?.[1] || null;
  const augUsados = new Set([...secLoot.matchAll(/<loot count="(\d+)"([^>]*?)>/g)].map((m) => augDe(m[2])).filter(Boolean));
  for (const m of secLoot.matchAll(/<loot count="(\d+)"([^>]*?)>([\s\S]*?)<\/loot>/g)) {
    const attrs = m[2];
    const idCB = (/<RulesElement[^>]*internal-id="([^"]*)"/.exec(m[3]) || [])[1];
    if (idCB && augUsados.has(idCB) && !augDe(attrs)) { augUsados.delete(idCB); continue; } // o shard está encaixado: não repete na mochila
    const rs = [...m[3].matchAll(/<RulesElement name="([^"]*)" type="([^"]*)"/g)].map((r) => ({ nome: ent(r[1]), tipo: r[2] }));
    const magico = rs.find((r) => r.tipo === 'Magic Item');
    const base = rs.find((r) => r.tipo !== 'Magic Item') || rs[0];
    const nome = ent((/name="([^"]*)"/.exec(attrs) || [])[1] || '') || magico?.nome || base?.nome || '';
    const equip = +((/equip-count="(\d+)"/.exec(attrs) || [])[1] || 0);
    if (!nome) continue;
    if (!(+m[1] > 0 || equip > 0)) continue;
    const enc = magico && semMais(magico.nome);
    const catBase = base && { Weapon: 'weapon', Armor: 'armor', Implement: 'implement', 'Superior Implement': 'implement', 'Holy Symbol': 'implement', Orb: 'implement', Rod: 'implement', Staff: 'implement', Wand: 'implement', Totem: 'implement', Tome: 'implement', Ki: 'implement' }[base.tipo];
    if (catBase) {
      const eb = acharPorNome(catBase, base.nome);
      const em = enc && acharPorNome(catBase, enc.nome);
      p.itens.push({ id: novoId(), cat: catBase, nome, qtd: +m[1], equipado: equip > 0,
        base: { cat: catBase, id: eb?.ID || null, nome: base.nome },
        ench: enc ? { cat: catBase, id: em?.ID || null, nome: enc.nome, mais: enc.mais, nivel: enc.nivel } : null });
      const aid = augDe(attrs);
      if (aid) { // acha o nome do shard no mesmo arquivo e liga ao compêndio
        const nm = (new RegExp('<RulesElement name="([^"]*)"[^>]*internal-id="' + aid + '"').exec(x) || [])[1];
        if (nm) {
          const t = /\((heroic|paragon|epic) tier\)\s*$/i.exec(ent(nm));
          const nomeShard = ent(nm).replace(/\s*\((heroic|paragon|epic) tier\)\s*$/i, '');
          p.itens[p.itens.length - 1].augment = { cat: 'weapon', id: acharPorNome('weapon', nomeShard)?.ID || null, nome: nomeShard, nivel: nivelDoShard(acharPorNome('weapon', nomeShard)?.ID, t?.[1]) };
        }
      }
    } else if (magico) {
      // item mágico avulso: pode ser anel/capa/etc. (item) ou um encantamento de arma, armadura ou implemento (Hungry Spirits Totem +1)
      let refCat = 'item', e = acharPorNome('item', enc.nome);
      if (!e) for (const c of ['implement', 'weapon', 'armor']) { const q = acharPorNome(c, enc.nome); if (q) { e = q; refCat = c; break; } }
      p.itens.push({ id: novoId(), cat: 'item', nome: enc.nome, qtd: +m[1], equipado: equip > 0,
        variante: { mais: enc.mais, nivel: enc.nivel }, ref: e ? { cat: refCat, id: e.ID } : null });
    } else {
      p.itens.push({ id: novoId(), cat: 'livre', nome, qtd: +m[1], equipado: equip > 0 });
    }
  }
  if (atr) p.atr = atr;
  p.valoresCB = { ca: s('AC'), fort: s('Fortitude Defense'), ref: s('Reflex Defense'), vont: s('Will Defense'), pv: s('Hit Points'), surtos: s('Healing Surges'), iniciativa: s('Initiative'), velocidade: s('Speed') };
  // bônus de perícia que o CB conta como "Misc" por escolhas que o motor não vê (ex.: antecedente): vira ajuste manual
  p.extras = ['Class Feature', 'Racial Trait', 'Grants', 'Build', 'Trait Package', 'Proficiency', 'Internal', 'Background Choice', 'Hybrid Class', 'Familiar']
    .flatMap((t) => els[t] || []).map((e) => ({ id: e.id, nome: e.nome }));
  try {
    let c = calcular(p);
    for (const per of PERICIAS) { const d = p.cbPericias[per] - c.pericias[per]; if (d) p.pericias[per].extra = d; }
    // o que sobrar entre o CB e o app vira "ajuste manual" visível na ficha (o CB conhece escolhas que o app não lê)
    const cb = p.valoresCB, aj = {};
    for (const [k, a, b] of [['ca', cb.ca, c.ac], ['fort', cb.fort, c.fort], ['ref', cb.ref, c.ref], ['vont', cb.vont, c.vont], ['pv', cb.pv, c.pv], ['surtos', cb.surtos, c.surtos], ['ini', cb.iniciativa, c.iniciativa], ['vel', cb.velocidade, c.velocidade]]) if (a - b) aj[k] = a - b;
    if (Object.keys(aj).length) p.ajustes = aj;
  } catch { /* sem ajuste */ }
  delete p.cbPericias;
  p.valoresCB = { ca: s('AC'), fort: s('Fortitude Defense'), ref: s('Reflex Defense'), vont: s('Will Defense'), pv: s('Hit Points'), surtos: s('Healing Surges'), iniciativa: s('Initiative'), velocidade: s('Speed') };

  // diário de aventura → janelas de anotações
  for (const m of x.matchAll(/<JournalEntry[\s\S]*?<\/JournalEntry>/g)) {
    const bloco = m[0];
    const titulo = tag(bloco, 'Title') || 'Anotação';
    const notas = tag(bloco, 'Notes');
    if (!notas && !titulo) continue;
    p.notas.push(novaNota(titulo, notas, tag(bloco, 'TimeStamp')));
  }
  if (tag(det, 'Notes')) p.notas.unshift(novaNota('Notas da ficha', tag(det, 'Notes')));
  p.historico.push({ quando: new Date().toISOString(), tipo: 'importacao', texto: 'Importado de arquivo .dnd4e.' });
  return p;
}

export function novaNota(titulo = 'Nova anotação', texto = '', criado) {
  const agora = new Date().toISOString();
  return {
    id: novoId(), titulo, texto, criado: criado && !isNaN(Date.parse(criado)) ? new Date(criado).toISOString() : agora, editado: agora,
    janela: { x: 60 + Math.floor(Math.random() * 120), y: 90 + Math.floor(Math.random() * 80), w: 420, h: 340, aberta: false, min: false },
    versoes: [],
  };
}

// tier do CB (heroic/paragon/epic) -> nível do shard (2/12/22, mas 1/11/21 ou 3/13/23 conforme o shard)
function nivelDoShard(id, tier) {
  const vs = id ? variantes('weapon', id) : [];
  const i = { heroic: 0, paragon: 1, epic: 2 }[String(tier || 'heroic').toLowerCase()];
  return vs[i]?.nivel ?? vs[vs.length - 1]?.nivel ?? [1, 11, 21][i];
}
