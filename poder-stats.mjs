// Acerto e dano de cada poder, por arma ou implemento: a ÚNICA fonte desse cálculo (Builder, Sheet e, depois, Roll20).
// Devolve só dados (sem texto de interface). Regras: ver power-stats-spec.md.
import * as comp from './compendio.mjs';
import { calcular, infoArma } from './calculo.mjs';
import { analisar, lerDano } from './roll20.mjs';
import { efeitosDoTexto } from './efeitos-texto.mjs';
import { efeitosDaFicha, classificar, rotuloOrigem } from './efeitos-ficha.mjs';

const ATRIBUTOS = [['Strength', 'for'], ['Constitution', 'con'], ['Dexterity', 'des'], ['Intelligence', 'int'], ['Wisdom', 'sab'], ['Charisma', 'car']];
const DEFESAS = { ac: 'AC', fortitude: 'Fortitude', reflex: 'Reflex', will: 'Will' };
// bônus que sempre acumulam (modificador, metade do nível, proficiência); só os "tipados" (enhancement, feat, item…) não acumulam entre si
const TIPOS_LIVRES = new Set(['', 'ability', 'level', 'proficiency']);

// Empilhamento: dois bônus positivos do mesmo tipo não acumulam (vale o maior); sem tipo e penalidades acumulam.
export function aplicarEmpilhamento(linhas) {
  const melhor = new Map();
  for (const l of linhas) {
    const tp = String(l.bonusType || '').toLowerCase();
    if (TIPOS_LIVRES.has(tp) || l.value <= 0) continue;
    const m = melhor.get(tp);
    if (!m || l.value > m.value) melhor.set(tp, l);
  }
  return linhas.map((l) => {
    const tp = String(l.bonusType || '').toLowerCase();
    return { ...l, applied: TIPOS_LIVRES.has(tp) || l.value <= 0 || melhor.get(tp) === l };
  });
}
const soma = (linhas) => linhas.filter((l) => l.applied).reduce((a, l) => a + l.value, 0);

// A arma serve a este talento/efeito? (sem grupo = qualquer arma)
const serve = (grupos, w) => !grupos.length || grupos.some((g) => g === w.grupo || w.grupo.split(/[,/]| or /).map((x) => x.trim()).includes(g));

// Proficiência: categoria da arma na lista da classe ("Simple melee, military melee…"), nome/grupo na lista, ou talento Weapon Proficiency (X)
// true / false, ou null quando a classe não pôde ser lida
function idDaClasse(nome) {
  if (!nome || /^hybrid/i.test(nome)) return null;
  const exato = comp.acharPorNome('class', nome);
  if (exato) return exato.ID;
  return comp.buscar('class', { q: nome }, 20).itens.find((c) => c.Name.toLowerCase().startsWith(nome.toLowerCase() + ' ('))?.ID || null;
}
function proficiente(P, w) {
  const m = /\b(Simple|Military|Superior)\s+(?:one-handed |two-handed )?(melee|ranged)/i.exec(w.texto || '');
  const nivelArma = m ? m[1].toLowerCase() : '', categoria = m ? `${m[1]} ${m[2]}`.toLowerCase() : '';
  const nomes = [w.nome, w.grupo].map((x) => String(x).toLowerCase());
  const grupos = String(w.grupo).split(/[,/]| or /).map((x) => x.trim().toLowerCase()).filter(Boolean);
  // talento "Weapon Proficiency (Waraxe)" (nome como o CB grava) ou talento cujo texto diz "you gain proficiency ... with axes and hammers"
  if (P.talentos?.some((f) => {
    const x = /^(?:Superior )?Weapon Proficiency\s*\(([^)]+)\)/i.exec(f.nome || '');
    if (x && nomes.includes(x[1].trim().toLowerCase())) return true;
    return f.id && efeitosDoTexto(comp.detalhe('feat', f.id)?.html).proficiencias.some((g) => g === w.nome.toLowerCase() || grupos.includes(g));
  })) return true;
  // lista da classe: "Simple melee, military melee, military heavy blade, longsword…" (classe escolhida pelo id, ou pelo nome quando a ficha veio de um .dnd4e)
  const id = P.classe?.id || idDaClasse(P.classe?.nome);
  const det = id && comp.detalhe('class', id);
  const lista = det && /Weapon Proficiencies?\s*:?\s*([^.]+)\./i.exec(String(det.html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  if (!lista) return null; // classe desconhecida (ex.: híbrida): não dá para afirmar
  return lista[1].split(/,|\band\b/i).map((x) => x.trim().toLowerCase()).filter(Boolean)
    .some((tk) => (categoria && tk === categoria) || nomes.includes(tk) || nomes.includes(tk.replace(/s$/, '')) || grupos.some((g) => tk === `${nivelArma} ${g}`));
}


const novaLinha = (value, bonusType, source, label) => ({ value, bonusType, source, label });
// Bônus além de atributo, nível, proficiência e aprimoramento: das regras do CB (por grupo da arma) e dos efeitos fixos lidos do compêndio
// (talentos, itens, raça, tema…). power = null para os campos fixos da arma no Roll20 (só entra o que não depende do poder).
function bonusAdicionais(c, efeitos, nivel, s, stat, power) {
  const grupos = s.grupo ? s.grupo.split(/[,/]| or /).map((x) => x.trim()).filter(Boolean) : [];
  const regras = c.detalheStat(stat, grupos).linhas.map((l) => novaLinha(l.valor, l.tipo, l.fonte, 'bonus'));
  const alvo = stat === 'attack rolls' ? 'attack' : 'damage';
  const fixos = [];
  for (const e of efeitos) {
    if (e.stat !== alvo) continue;
    const k = classificar(e, { nivel, s, power });
    if (k?.classe !== 'fixo' || k.valor == null) continue;
    const tp = e.bonusType === 'untyped' ? '' : e.bonusType;
    fixos.push({ ...novaLinha(k.valor, tp, rotuloOrigem(e.origem), tp ? tp + ' bonus' : 'bonus'), powerSpecific: k.especificoDoPoder });
  }
  return [...regras, ...fixos.filter((l) => !regras.some((r) => r.source === l.source))];
}

// Para a ficha do Roll20: a proficiência (0 se a classe/talentos não dão proficiência com a arma) e o que a arma soma além dela e do aprimoramento (campos weapon-N-attack-misc e damage-misc),
// já com o empilhamento. Usa as mesmas regras do cálculo por poder.
export function bonusDaArma(P, item, c = calcular(P)) {
  // itens soltos (cat 'item') cujo ref aponta pra uma arma/implemento de verdade (ex.: "Iron Wand" equipado,
  // sem base/encantamento separados) também contam como arma/implemento, não só item.cat==='weapon'/'implement'.
  const baseRef = item.base?.id ? { cat: item.cat === 'implement' ? 'implement' : 'weapon', id: item.base.id } : (item.ref?.id && ['weapon', 'implement'].includes(item.ref.cat) ? item.ref : null);
  const w = baseRef && infoArma(baseRef.cat, baseRef.id);
  if (!w) return { attackMisc: 0, damageMisc: 0, prof: 0 };
  const mais = +item.ench?.mais || 0;
  const s = { tipo: baseRef.cat, nome: nomeDoItem(item), item, w, mais, grupo: w.grupo };
  const efeitos = efeitosDaFicha(P);
  const misc = (stat) => {
    const linhas = aplicarEmpilhamento([novaLinha(mais, 'enhancement', s.nome, 'enhancement bonus'), ...bonusAdicionais(c, efeitos, c.nivel, s, stat, null)]);
    return soma(linhas) - mais;
  };
  return { attackMisc: misc('attack rolls'), damageMisc: misc('damage rolls'), prof: proficiente(P, w) === false ? 0 : w.prof };
}

function fontesDoPoder(P, c, an, det) {
  const pal = an.palavras.map((p) => p.toLowerCase());
  const melee = /melee/i.test(an.alcance), ranged = /ranged/i.test(an.alcance);
  const equipados = (P.itens || []).filter((i) => i.equipado);
  const mais = (i) => +i.ench?.mais || 0;
  if (pal.includes('weapon')) {
    return equipados.filter((i) => i.cat === 'weapon' && i.base?.id).map((i) => ({ i, w: infoArma('weapon', i.base.id) })).filter((x) => x.w)
      .filter(({ w }) => !(melee && !ranged && w.distancia) && !(ranged && !melee && !w.distancia))
      .map(({ i, w }) => ({ tipo: 'weapon', nome: nomeDoItem(i), item: i, w, mais: mais(i), grupo: w.grupo }));
  }
  if (pal.includes('implement')) {
    return equipados.filter((i) => i.cat === 'implement').map((i) => ({ tipo: 'implement', nome: nomeDoItem(i), item: i, w: null, mais: mais(i), grupo: '' }));
  }
  return [{ tipo: 'power', nome: det.meta?.Name || '', item: null, w: null, mais: 0, grupo: '' }];
}
// como o Character Builder mostra: "Blood Fury Weapon" + Waraxe -> "Blood Fury Waraxe +2"
const maiusc = (x) => String(x).replace(/\b[a-z]/g, (m) => m.toUpperCase());
const nomeDoItem = (i) => (i.ench
  ? `${String(i.ench.nome).replace(/\s+(Weapon|Armor|Implement)$/i, '')} ${maiusc(i.base?.nome || '')}${i.ench.mais ? ' +' + i.ench.mais : ''}`.replace(/\s+/g, ' ').trim()
  : (i.nome || i.base?.nome || ''));

// "Level 21: 2[W] + Strength modifier damage" -> maior limite <= nível do personagem
function textoDeDano(an, nivel) {
  const hit = an.campos.find((x) => /^hit$/i.test(x.rotulo))?.texto || '';
  let base = hit, melhor = 0;
  const cand = [];
  for (const x of an.campos) { const m = /^Level (\d+)$/i.exec(x.rotulo); if (m) cand.push([+m[1], x.texto]); }
  for (const m of hit.matchAll(/Level (\d+):\s*([^.]*?damage)/gi)) cand.push([+m[1], m[2]]);
  for (const [n, tx] of cand) if (n <= nivel && n > melhor && /damage/i.test(tx)) { melhor = n; base = tx; }
  return base;
}

export function calculatePowerStats(P, power, c = calcular(P)) {
  const det = comp.detalhe('power', power.id);
  if (!det) return null;
  const an = analisar(det.html);
  an.palavras = [...new Set([...an.palavras, ...(an.palavrasExtra || [])])]; // inclui o poder concedido (ex.: Weapon)
  const nivel = c.nivel;
  const campoAtq = an.campos.find((x) => /^attack$/i.test(x.rotulo))?.texto || '';
  const defM = /\bvs\.?\s*(AC|Fortitude|Reflex|Will)\b/i.exec(campoAtq);
  const defense = defM ? DEFESAS[defM[1].toLowerCase()] : null;
  const atrsAtq = ATRIBUTOS.filter(([en]) => campoAtq.split(/\bvs\b/i)[0].includes(en));
  const dano = lerDano(textoDeDano(an, nivel));
  const efeitos = efeitosDaFicha(P);
  const ctxPoder = { nome: det.meta?.Name || '', palavras: an.palavras, tipo: an.tipo || '', alcance: an.alcance || '' };
  const notas = [];

  const resultados = fontesDoPoder(P, c, an, det).map((s) => {
    const grupos = s.grupo ? s.grupo.split(/[,/]| or /).map((x) => x.trim()).filter(Boolean) : [];
    const nova = (value, bonusType, source, label) => ({ value, bonusType, source, label });
    const outros = (stat) => bonusAdicionais(c, efeitos, nivel, s, stat, ctxPoder);
    // efeitos que não entram no total: perguntas Sim/Não, informativos e dano extra de crítico; e dano extra em dados que vale sempre
    const classificados = efeitos.map((e) => ({ e, k: classificar(e, { nivel, s, power: ctxPoder }) })).filter((x) => x.k);

    // acerto
    let atq = null, atqTotal = null;
    if (campoAtq) {
      const melhorAtr = atrsAtq.map(([en, k]) => ({ en, v: c.modificadores[k] })).sort((a, b) => b.v - a.v)[0];
      const linhas = [];
      if (melhorAtr) linhas.push(nova(melhorAtr.v, 'ability', 'Atributos', `${melhorAtr.en} modifier`));
      linhas.push(nova(Math.floor(nivel / 2), 'level', 'Nível', 'half your level'));
      if (s.tipo === 'weapon' && s.w && proficiente(P, s.w) !== false && s.w.prof) linhas.push(nova(s.w.prof, 'proficiency', s.nome, 'proficiency bonus'));
      if (s.mais) linhas.push(nova(s.mais, 'enhancement', s.nome, 'enhancement bonus'));
      linhas.push(...outros('attack rolls'));
      atq = aplicarEmpilhamento(linhas);
      atqTotal = soma(atq);
    }

    // dano
    let dmg = null, expressao = null;
    if (dano) {
      const linhas = [];
      const am = dano.atributo && ATRIBUTOS.find(([en]) => en.toLowerCase() === String(dano.atributo).toLowerCase());
      if (am) linhas.push(nova(c.modificadores[am[1]], 'ability', 'Atributos', `${am[0]} modifier`));
      if (s.mais && s.tipo !== 'power') linhas.push(nova(s.mais, 'enhancement', s.nome, 'enhancement bonus'));
      for (const e of dano.estatico) if (/^\d+$/.test(e)) linhas.push(nova(+e, 'power', det.meta?.Name || 'Poder', 'power bonus'));
      linhas.push(...outros('damage rolls'));
      const dadosFixos = classificados.filter(({ e, k }) => e.stat === 'damage' && k.classe === 'fixo' && k.dados);
      for (const { e, k } of dadosFixos) linhas.push({ ...nova(0, e.bonusType === 'untyped' ? '' : e.bonusType, rotuloOrigem(e.origem), 'extra damage'), dice: k.dados, powerSpecific: k.especificoDoPoder });
      dmg = aplicarEmpilhamento(linhas);
      let dados;
      if (dano.arma) {
        const wd = s.w && /^(\d+)d(\d+)$/.exec(s.w.dano || '');
        dados = wd ? `${dano.qtd * +wd[1]}d${wd[2]}` : (notas.push('sem dado de arma'), `${dano.qtd}[W]`);
      } else dados = `${dano.qtd}d${dano.lados}`;
      const extras = dano.estatico.filter((e) => /^\d+d\d+$/.test(e)).concat(dadosFixos.map(({ k }) => k.dados)).map((e) => '+' + e).join('');
      const fixo = soma(dmg);
      expressao = `${dados}${extras}${fixo > 0 ? '+' + fixo : fixo < 0 ? String(fixo) : ''}`;
    }

    const condicionais = classificados.filter(({ k }) => k.classe !== 'fixo').map(({ e, k }) => ({
      value: k.valor, dice: k.dados, appliesTo: e.stat, condition: e.condition || '', conditionPt: e.conditionPt || null, source: e.origem.nome,
      kind: k.classe === 'pergunta' ? 'ask' : k.classe === 'critico' ? 'critical' : 'info', critAsk: !!k.perguntaNoCritico, note: e.note || '',
    }));

    return {
      source: { kind: s.tipo, name: s.nome, itemId: s.item?.id || null, enhancement: s.mais, group: s.grupo, proficient: s.tipo === 'weapon' ? (s.w ? proficiente(P, s.w) : false) : null },
      attackTotal: atqTotal, defense, damageExpression: expressao, attackBreakdown: atq, damageBreakdown: dmg, conditionalModifiers: condicionais,
    };
  });
  if (!resultados.length) notas.push('nenhuma arma ou implemento equipado serve a este poder');
  return { power: { id: power.id, name: det.meta?.Name || '', keywords: an.palavras, range: an.alcance }, characterLevel: nivel, results: resultados, notes: notas };
}
