// Interpreta as PASSIVAS de itens mágicos escritas em texto ("Gain a +2 item bonus to Acrobatics checks") e as
// transforma em bônus que o motor de cálculo soma sozinho. Só aplica o que não tem condição; o que depende de situação
// ("when you use a bow", "to escape") vira lista de bônus situacionais (aparece na macro, não entra na conta).
import * as comp from './compendio.mjs';

const PERICIAS = ['Acrobatics', 'Arcana', 'Athletics', 'Bluff', 'Diplomacy', 'Dungeoneering', 'Endurance', 'Heal', 'History', 'Insight', 'Intimidate', 'Nature', 'Perception', 'Religion', 'Stealth', 'Streetwise', 'Thievery'];
const TIPOS = { item: 'item', power: 'Power', feat: 'Feat', racial: 'Racial', untyped: '', proficiency: 'Proficiency', enhancement: 'Enhancement', shield: 'Shield', armor: 'Armor' };
const DEF = { fortitude: 'Fortitude Defense', reflex: 'Reflex Defense', will: 'Will Defense' };

const texto = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Linhas das seções "Property/Properties" do item, já escolhendo a versão "Level N:" que vale para o nível do item.
export function linhasPropriedade(cat, id, nivelItem) {
  const det = comp.detalhe(cat, id);
  if (!det || !/class=mihead/.test(det.html)) return [];
  const partes = [];
  let dentro = false;
  for (const m of det.html.matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>|<p class=['"]?(mistat[^'">]*)['"]?>([\s\S]*?)<\/p>/g)) {
    if (m[2] !== undefined) { if (/ah1/.test(m[1])) break; dentro = /^\W*Propert/i.test(texto(m[2])); continue; }
    if (dentro) partes.push(...m[4].split(/<br\s*\/?>/i).map(texto).filter(Boolean));
  }
  // "Level 16: Gain a +4 item bonus." substitui o texto base quando o item é desse nível ou maior
  let base = [], escolhido = null, melhor = 0;
  for (const l of partes) {
    const lv = /^Level\s+(\d+)\s*:\s*(.*)$/i.exec(l);
    if (lv) { if (+lv[1] <= nivelItem && +lv[1] >= melhor) { melhor = +lv[1]; escolhido = lv[2]; } } else base.push(l);
  }
  if (escolhido) { // a linha de nível só traz a parte que muda: completa com o texto base trocando o número
    const num = /\+(\d+)/.exec(escolhido);
    if (num && base.length) base = base.map((b) => b.replace(/\+\d+/, '+' + num[1]));
    else base.push(escolhido);
  }
  return base;
}

function alvos(frase) {
  // devolve { stats:[nomes do motor], resto:'texto que sobrou' }
  let t = ' ' + frase + ' ';
  const stats = [];
  const tira = (re, nomes) => { if (re.test(t)) { stats.push(...[].concat(nomes)); t = t.replace(re, ' '); } };
  tira(/\b(all|your) defenses\b|\ball of your defenses\b/ig, ['Armor Class', 'Fortitude Defense', 'Reflex Defense', 'Will Defense']);
  tira(/\battack rolls?\b/ig, 'Attack Rolls');
  tira(/\bdamage rolls?\b/ig, 'Damage Rolls');
  tira(/\barmor class\b|\bAC\b/g, 'Armor Class');
  for (const [k, v] of Object.entries(DEF)) tira(new RegExp(`\\b${k}\\b`, 'ig'), v);
  tira(/\binitiative( checks?| rolls?)?\b/ig, 'Initiative');
  tira(/\bspeed\b/ig, 'Speed');
  if (/\ball skill checks\b|\bskill checks\b/i.test(t) && !PERICIAS.some((p) => new RegExp(`\\b${p}\\b`, 'i').test(t))) { tira(/\b(all )?skill checks\b/ig, PERICIAS.map((p) => p + ' Misc')); }
  for (const p of PERICIAS) tira(new RegExp(`\\b${p}\\b`, 'ig'), p + ' Misc');
  const resto = t.replace(/\b(checks?|rolls?|defenses?|defense|and|or|to|the|your|all|of|a|an|bonus|skills?|you|gain|gains|have)\b/ig, ' ').replace(/[,.;:()]/g, ' ').replace(/\s+/g, ' ').trim();
  return { stats, resto };
}

// -> { aplicaveis:[{stat, valor, tipo, texto}], situacionais:[texto], resistencias:[texto] }
export function interpretar(linhas, mais = 0) {
  const r = { aplicaveis: [], situacionais: [], resistencias: [] };
  for (const linha of linhas) {
    for (const frase of linha.split(/(?<=\.)\s+/)) {
      if (/\bresist(?:ance)?\s+(?:\d+|equal)/i.test(frase)) { r.resistencias.push(frase.replace(/\.$/, '')); continue; }
      const regs = [
        // "+2 item bonus to X"
        { re: /(?:^|[\s,])\+(\d+)\s+(item|power|feat|racial|untyped|proficiency|enhancement)?\s*bonus\s+(?:to|on)\s+([^.;]+)/i, valor: (m) => +m[1], tipo: (m) => m[2], alvo: (m) => m[3] },
        // "an item bonus to X equal to the item's enhancement bonus"
        { re: /\ban?\s+(item|power|feat|racial|enhancement)\s+bonus\s+(?:to|on)\s+(.+?)\s+equal to (?:the|this)?\s*(?:item'?s?|weapon'?s?|armor'?s?)?\s*enhancement bonus/i, valor: () => mais, tipo: (m) => m[1], alvo: (m) => m[2] },
      ];
      let achou = false;
      for (const g of regs) {
        const m = g.re.exec(frase);
        if (!m) continue;
        achou = true;
        const valor = g.valor(m);
        const { stats, resto } = alvos(g.alvo(m));
        if (!valor || !stats.length) { r.situacionais.push(frase.replace(/\.$/, '')); break; }
        if (resto || /\b(when|while|if|against|during|until|once|whenever|only|using|with)\b/i.test(frase.slice(m.index + m[0].length - 0)) || /\b(when|while|if|whenever)\b/i.test(frase)) {
          r.situacionais.push(frase.replace(/\.$/, '')); break;
        }
        for (const stat of stats) r.aplicaveis.push({ stat, valor, tipo: TIPOS[(g.tipo(m) || '').toLowerCase()] ?? '', texto: frase.replace(/\.$/, '') });
        break;
      }
      if (!achou && /\+\d+|\bbonus\b|\bpenalty\b/i.test(frase)) r.situacionais.push(frase.replace(/\.$/, ''));
    }
  }
  return r;
}

export const PERICIAS_EN = PERICIAS;
