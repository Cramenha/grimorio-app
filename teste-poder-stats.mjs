// Testes do cálculo de acerto e dano por poder (poder-stats.mjs). Uso: node teste-poder-stats.mjs
// Personagem de referência: Autumn Redfang, Longtooth Shifter Warden, nível 10 (power-stats-spec.md).
import assert from 'node:assert/strict';
import { calculatePowerStats, aplicarEmpilhamento } from './poder-stats.mjs';
import { exportarRoll20 } from './roll20-ficha.mjs';
import { definirBancoDeEfeitos } from './efeitos-ficha.mjs';

const feat = (id, nome) => ({ cat: 'feat', id, nome });
const arma = (baseId, baseNome, encId, encNome, mais) => ({ id: baseId + encId, cat: 'weapon', base: { id: baseId, nome: baseNome }, ench: { cat: 'weapon', id: encId, nome: encNome, mais }, equipado: true });
const autumn = (nivel = 10, itens) => ({
  nivel, classe: { cat: 'class', id: 'class134', nome: 'Warden' },
  atr: { base: { for: 20, con: 13, des: 11, int: 8, sab: 20, car: 10 } },
  nome: 'Autumn Redfang', poderes: [{ cat: 'power', id: 'power5098', nome: 'Weight of Earth', nivel: 1 }], pericias: {}, notas: [], extras: [],
  talentos: [feat('feat3122', 'Axe Expertise'), feat('feat178', 'Weapon Proficiency (Waraxe)'), feat('feat2598', "Headsman's Chop")],
  itens: itens || [arma('weapon3648', 'Waraxe', 'weapon691', 'Blood Fury Weapon', 2), arma('weapon3728', 'Wrist razors', 'weapon2188', 'Rhythm Blade', 1)],
});
const WEIGHT_OF_EARTH = { id: 'power5098' };
const por = (r, nome) => r.results.find((x) => x.source.name.toLowerCase().includes(nome.toLowerCase()));
const linha = (lista, label) => lista.find((l) => l.label === label);
let n = 0;
const t = (nome, f) => { f(); n++; console.log('ok -', nome); };

definirBancoDeEfeitos({}); // núcleo da suíte: só regras do CB + leitura por regex dos talentos (sem o arquivo efeitos.json)
const r10 = calculatePowerStats(autumn(10), WEIGHT_OF_EARTH);
const waraxe = por(r10, 'Waraxe'), razors = por(r10, 'Wrist Razors');

t('Waraxe +2: +15 de acerto e 1d12+7 de dano, contra AC', () => {
  assert.equal(waraxe.source.name, 'Blood Fury Waraxe +2'); assert.equal(razors.source.name, 'Rhythm Blade Wrist Razors +1');
  assert.equal(waraxe.attackTotal, 15); assert.equal(waraxe.damageExpression, '1d12+7'); assert.equal(waraxe.defense, 'AC');
});
t('Waraxe: composição do acerto (5 For + 5 metade do nível + 2 proficiência + 2 aprimoramento + 1 Axe Expertise)', () => {
  const a = waraxe.attackBreakdown.filter((l) => l.applied);
  assert.deepEqual(a.map((l) => [l.value, l.bonusType, l.label]), [[5, 'ability', 'Strength modifier'], [5, 'level', 'half your level'], [2, 'proficiency', 'proficiency bonus'], [2, 'enhancement', 'enhancement bonus'], [1, 'feat', 'feat bonus']]);
  assert.equal(a[4].source, 'Talento: Axe Expertise');
});
t('Waraxe: composição do dano (5 For + 2 aprimoramento; sem metade do nível)', () => {
  assert.deepEqual(waraxe.damageBreakdown.filter((l) => l.applied).map((l) => [l.value, l.bonusType]), [[5, 'ability'], [2, 'enhancement']]);
  assert.ok(!waraxe.damageBreakdown.some((l) => l.bonusType === 'level'));
});
t('Wrist Razors +1: +14 de acerto e 1d4+6 (proficiência +3 pela classe; Axe Expertise não se aplica)', () => {
  assert.equal(razors.attackTotal, 14); assert.equal(razors.damageExpression, '1d4+6');
  assert.deepEqual(razors.attackBreakdown.filter((l) => l.applied).map((l) => [l.value, l.bonusType]), [[5, 'ability'], [5, 'level'], [3, 'proficiency'], [1, 'enhancement']]);
});
t('Headsman\'s Chop só como condicional, fora dos totais, e só na arma de machado', () => {
  assert.equal(waraxe.conditionalModifiers.length, 1);
  const cm = waraxe.conditionalModifiers[0];
  assert.deepEqual([cm.value, cm.appliesTo, cm.source, cm.kind, /prone/.test(cm.condition)], [5, 'damage', "Headsman's Chop", 'ask', true]);
  assert.deepEqual(razors.conditionalModifiers, []);
  assert.ok(![...waraxe.attackBreakdown, ...waraxe.damageBreakdown].some((l) => /Headsman/.test(l.source)));
});
t('nível 21: poder passa a 2[W] e a metade do nível vira +10', () => {
  const r21 = calculatePowerStats(autumn(21), WEIGHT_OF_EARTH);
  const w = por(r21, 'Waraxe');
  assert.equal(linha(w.attackBreakdown, 'half your level').value, 10);
  assert.ok(w.damageExpression.startsWith('2d12'), w.damageExpression);
  assert.equal(r10.characterLevel, 10); assert.equal(r21.characterLevel, 21);
});
t('Axe Expertise sobe para +2 no nível 11', () => {
  const w = por(calculatePowerStats(autumn(11), WEIGHT_OF_EARTH), 'Waraxe');
  assert.equal(linha(w.attackBreakdown, 'feat bonus').value, 2);
});
t('o nível do poder (campo da ficha) não altera nada; só o nível do personagem', () => {
  const a = calculatePowerStats(autumn(10), { id: 'power5098', nivel: 1 }), b = calculatePowerStats(autumn(10), { id: 'power5098', nivel: 25 });
  assert.deepEqual(a, b);
});
t('sem proficiência (tira o talento Weapon Proficiency): a Waraxe perde o +2', () => {
  const p = autumn(10); p.talentos = p.talentos.filter((f) => !/Proficiency/.test(f.nome));
  const w = por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe');
  assert.equal(w.attackTotal, 13); assert.equal(w.source.proficient, false);
});
t('empilhamento: mesmo tipo não acumula (vale o maior)', () => {
  const r = aplicarEmpilhamento([{ value: 1, bonusType: 'feat' }, { value: 3, bonusType: 'feat' }, { value: 2, bonusType: 'item' }]);
  assert.deepEqual(r.map((l) => l.applied), [false, true, true]);
  assert.equal(r.filter((l) => l.applied).reduce((a, l) => a + l.value, 0), 5);
});
t('empilhamento: sem tipo acumula; penalidades sempre acumulam', () => {
  const r = aplicarEmpilhamento([{ value: 1, bonusType: '' }, { value: 1, bonusType: '' }, { value: -2, bonusType: 'feat' }, { value: -1, bonusType: 'feat' }]);
  assert.ok(r.every((l) => l.applied));
});
t('Weapon sem arma equipada não inventa arma', () => {
  const r = calculatePowerStats(autumn(10, []), WEIGHT_OF_EARTH);
  assert.equal(r.results.length, 0); assert.ok(r.notes.length);
});
t('Roll20: os campos da ficha reproduzem o acerto e o dano do cálculo por poder (weapon-N: proficiência + aprimoramento + misc)', () => {
  const a = exportarRoll20(autumn(10), 'en').atributos;
  for (const [k, arma] of [[1, waraxe], [2, razors]]) {
    const acerto = 5 + 5 + a[`weapon-${k}-prof`] + a[`weapon-${k}-enh`] + a[`weapon-${k}-attack-misc`];
    assert.equal(acerto, arma.attackTotal, `acerto weapon-${k}`);
    const dano = 5 + a[`weapon-${k}-enh`] + a[`weapon-${k}-damage-misc`];
    assert.equal(dano, +arma.damageExpression.split('+')[1], `dano weapon-${k}`);
  }
  assert.equal(a['weapon-1-attack-misc'], 1); assert.equal(a['weapon-2-attack-misc'], 0);
});
t('Roll20: o efeito condicional vai numa habilidade à parte, fora dos campos de acerto e dano', () => {
  const h = exportarRoll20(autumn(10), 'en').habilidades.find((y) => y.nome === 'Efeitos-Adicionais');
  assert.ok(h && /Headsman's Chop/.test(h.macro) && /prone/.test(h.macro));
});
t('Roll20: arma sem proficiência sai com weapon-N-prof 0; classe só com o nome (ficha importada do CB) e híbrida continuam com a proficiência', () => {
  const p = autumn(10); p.talentos = p.talentos.filter((f) => !/Proficiency/.test(f.nome));
  const a = exportarRoll20(p, 'en').atributos;
  assert.equal(a['weapon-1-prof'], 0); assert.equal(a['weapon-2-prof'], 3);
  const clerigo = { ...autumn(10, [arma('weapon3648', 'Waraxe', 'weapon691', 'Blood Fury Weapon', 2)]), classe: { cat: 'class', id: null, nome: 'Cleric' }, talentos: [] };
  assert.equal(exportarRoll20(clerigo, 'en').atributos['weapon-1-prof'], 0, 'Waraxe é superior: clérigo sem o talento não é proficiente');
  const hibrida = { ...clerigo, classe: { cat: 'class', id: null, nome: 'Hybrid' } };
  assert.equal(exportarRoll20(hibrida, 'en').atributos['weapon-1-prof'], 2, 'classe desconhecida: mantém a proficiência da arma');
});
t('Roll20: o bônus condicional vira pergunta "Alvo derrubado?" no dano e no crítico da macro (Não = 0, Sim = +5), só no poder com dano e arma de machado', () => {
  const x = exportarRoll20(autumn(10), 'pt');
  const m = x.poderes[0].macro;
  assert.ok(/\{\{damage=\[\[[^]*?\?\{[^|]*prone[^|]*Headsman's Chop\|Não,0\|Sim,5\}/.test(m) && (m.match(/\|Não,0\|Sim,5\}/g) || []).length === 2, 'uma pergunta no dano e uma no crítico');
  assert.equal(x.atributos['weapon-1-damage-misc'], 0, 'o condicional não entra no campo fixo da arma');
  const en = exportarRoll20(autumn(10), 'en').poderes[0].macro;
  assert.ok(/\?\{[^|]*prone[^|]*Headsman's Chop\|No,0\|Yes,5\}/.test(en));
  const semMachado = exportarRoll20(autumn(10, [arma('weapon3728', 'Wrist razors', 'weapon2188', 'Rhythm Blade', 1)]), 'pt').poderes[0].macro;
  assert.ok(!semMachado.includes('?{'), 'sem arma de machado/heavy blade não há pergunta');
});

// ---- efeitos vindos do banco (efeitos.json), injetado para o teste não depender da extração por IA
const base = { dice: null, damageType: null, bonusType: 'feat', scaling: null, condition: null, conditionPt: null, askable: false, minLevel: 1, viaPower: null, choice: false, note: '',
  appliesTo: { weaponGroups: [], keywords: [], powerKinds: [], attackKind: 'any', implementOnly: false, weaponOnly: false } };
const ef = (o) => ({ ...base, ...o, appliesTo: { ...base.appliesTo, ...(o.appliesTo || {}) } });
const comBanco = (efeitos, fn, ficha = autumn(10)) => {
  definirBancoDeEfeitos({ 'feat:feat2598': { nome: "Headsman's Chop", efeitos } });
  try { return fn(ficha); } finally { definirBancoDeEfeitos(null); }
};
const so = (l) => l.filter((x) => x.applied);
t('efeitos: bônus fixo sem condição entra no total do acerto e do dano e no campo fixo da arma; não vira pergunta', () => {
  comBanco([ef({ stat: 'attack', value: 1, bonusType: 'item' }), ef({ stat: 'damage', value: 2, bonusType: 'racial' })], (p) => {
    const w = por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe');
    assert.equal(w.attackTotal, 16); assert.equal(w.damageExpression, '1d12+9'); assert.equal(w.conditionalModifiers.length, 0);
    const a = exportarRoll20(p, 'pt').atributos;
    assert.equal(a['weapon-1-attack-misc'], 2); assert.equal(a['weapon-1-damage-misc'], 2);
  });
});
t('efeitos: dois bônus do mesmo tipo vindos do banco não acumulam; sem tipo acumulam', () => {
  comBanco([ef({ stat: 'attack', value: 1 }), ef({ stat: 'attack', value: 3 })], (p) => assert.equal(por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe').attackTotal, 15 - 1 + 3), autumn(10));
  comBanco([ef({ stat: 'attack', value: 1, bonusType: 'untyped' }), ef({ stat: 'attack', value: 2, bonusType: 'untyped' })], (p) => assert.equal(por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe').attackTotal, 15 + 3));
});
t('efeitos: pergunta de ataque, de dano com dado e dano extra de crítico entram nas linhas certas da macro', () => {
  comBanco([
    ef({ stat: 'attack', value: 2, condition: 'target is marked', conditionPt: 'Alvo marcado?', askable: true }),
    ef({ stat: 'damage', dice: '1d8', condition: 'first attack of the turn', conditionPt: 'Primeiro ataque do turno?', askable: true }),
    ef({ stat: 'damage', dice: '5d6', condition: 'on a critical hit', askable: true, appliesTo: { weaponGroups: ['axe'] } }),
  ], (p) => {
    const m = exportarRoll20(p, 'pt').poderes[0].macro;
    const linha = (tag) => m.slice(m.indexOf('{{' + tag + '=[['), m.indexOf('}}', m.indexOf('{{' + tag + '=[[') + 10) + 2);
    assert.ok(linha('attack').includes('?{Alvo marcado? - Headsman'));
    assert.ok(linha('damage').includes('Primeiro ataque do turno? - Headsman') && linha('damage').includes('|Sim,1d8}'));
    assert.ok(linha('critical').includes('|Sim,8}'), 'no crítico o dado extra vale o máximo');
    assert.ok(linha('critical').includes('+ 5d6 [Headsman'), 'dano extra de crítico entra só no crítico');
    assert.ok(!linha('damage').includes('5d6'));
  });
});
t('efeitos: dano extra em dados que sempre vale entra na expressão, no dano e no máximo do crítico; só com a palavra-chave do poder', () => {
  comBanco([ef({ stat: 'damage', dice: '1d10', bonusType: 'item', appliesTo: { keywords: ['primal'] } }), ef({ stat: 'damage', dice: '1d6', appliesTo: { keywords: ['radiant'] } })], (p) => {
    const w = por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe');
    assert.equal(w.damageExpression, '1d12+1d10+7', 'só o efeito de primal (Weight of Earth é Primal)');
    const m = exportarRoll20(p, 'pt').poderes[0].macro;
    assert.ok(m.includes('+ 1d10 [Item') || m.includes('+ 1d10 [Talento'), 'dado somado na macro');
    assert.ok(m.includes('+ 10 [') && !m.includes('1d6'));
    assert.equal(exportarRoll20(p, 'pt').atributos['weapon-1-damage-misc'], 0, 'dado e efeito do poder não vão para o campo fixo da arma');
  });
});
t('efeitos: bônus fixo que depende do poder vai na macro (não no campo da arma); nível mínimo e poder específico filtram', () => {
  comBanco([
    ef({ stat: 'attack', value: 2, bonusType: 'power', appliesTo: { powerKinds: ['at-will'], attackKind: 'melee' } }),
    ef({ stat: 'attack', value: 4, minLevel: 11 }),
    ef({ stat: 'damage', value: 3, viaPower: 'Outro Poder' }),
    ef({ stat: 'damage', value: 3, viaPower: 'Weight of Earth' }),
  ], (p) => {
    const w = por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe');
    assert.equal(w.attackTotal, 17, '+2 do poder at-will corpo a corpo; o +4 de nível 11 não vale no nível 10');
    assert.equal(w.damageExpression, '1d12+10', 'só o viaPower correto');
    const x = exportarRoll20(p, 'pt');
    assert.equal(x.atributos['weapon-1-attack-misc'], 1, 'só Axe Expertise (+1) no campo fixo');
    assert.ok(/\{\{attack=\[\[[^]*?\+ 2 \[[^\]]*\] \]\] vs/.test(x.poderes[0].macro), '+2 direto na linha de ataque da macro');
    const w11 = por(calculatePowerStats(autumn(11), WEIGHT_OF_EARTH), 'Waraxe');
    assert.ok(w11.attackTotal >= 0);
  });
});
t('efeitos: condição que o app não sabe responder e escolha do jogador viram linha informativa, fora do cálculo', () => {
  comBanco([ef({ stat: 'damage', value: 2, condition: 'while bloodied', conditionPt: 'Você está sangrando?', askable: false }), ef({ stat: 'attack', value: 1, choice: true, condition: null })], (p) => {
    const w = por(calculatePowerStats(p, WEIGHT_OF_EARTH), 'Waraxe');
    assert.equal(w.attackTotal, 15); assert.equal(w.damageExpression, '1d12+7');
    assert.deepEqual(w.conditionalModifiers.map((c) => c.kind), ['info', 'info']);
    const m = exportarRoll20(p, 'pt').poderes[0].macro;
    assert.ok(/\{\{\*\*Condicionais \(não calculados\):\*\*=[^}]*sangrando/.test(m));
    assert.ok(!m.includes('?{'));
  });
});
const comChaves = (chaves, fn, ficha = autumn(10)) => { definirBancoDeEfeitos(chaves); try { return fn(ficha); } finally { definirBancoDeEfeitos(null); } };
t('efeitos: valor que depende de outra coisa (sem número nem dado) vira informativo com a nota, nunca é descartado', () => {
  comBanco([ef({ stat: 'damage', note: 'Dano igual ao modificador de Destreza', condition: 'missed with an encounter power', askable: true })], (p) => {
    const r = calculatePowerStats(p, WEIGHT_OF_EARTH);
    const c = por(r, 'Waraxe').conditionalModifiers[0];
    assert.equal(c.kind, 'info'); assert.match(c.note, /Destreza/);
    assert.match(exportarRoll20(p, 'pt').poderes[0].macro, /Condicionais \(não calculados\)[^}]*Destreza/);
  });
});
t('efeitos: item usa o nível do ITEM para a escala e o nível mínimo, e "por +1 de aprimoramento" multiplica os dados', () => {
  const p = autumn(10); p.itens[0].ench.nivel = 8;
  const dados = (n) => comChaves({ 'weapon:weapon691': { nome: 'Blood Fury', efeitos: [ef({ stat: 'damage', bonusType: 'item', scaling: [[3, 1], [8, 2], [13, 3]], minLevel: 3 })] } },
    (x) => por(calculatePowerStats(x, WEIGHT_OF_EARTH), 'Waraxe').damageExpression, n);
  assert.equal(dados(p), '1d12+9', 'item nível 8: +2 (e não o degrau do nível 10 do personagem)');
  const p13 = autumn(10); p13.itens[0].ench.nivel = 13;
  assert.equal(dados(p13), '1d12+10', 'item nível 13: +3');
  comChaves({ 'weapon:weapon691': { nome: 'Blood Fury', efeitos: [ef({ stat: 'damage', dice: '1d8', condition: 'on a critical hit', askable: true, note: 'Crítico: +1d8 para cada +1 de aprimoramento da arma' })] } }, (x) => {
    const m = exportarRoll20(x, 'pt').poderes[0].macro;
    assert.ok(m.includes('+ 2d8 [Blood Fury'), 'Waraxe +2 no crítico: 2d8');
  });
});
t('efeitos: crítico com condição extra vira pergunta só na linha de crítico; crítico puro soma direto', () => {
  comBanco([ef({ stat: 'damage', dice: '1d10', condition: 'critical hit against an aberrant creature', conditionPt: 'Alvo aberrante?', askable: true }), ef({ stat: 'damage', dice: '2d6', condition: 'on a critical hit', askable: true })], (p) => {
    const m = exportarRoll20(p, 'pt').poderes[0].macro;
    const linha = (tag) => m.slice(m.indexOf('{{' + tag + '=[['), m.indexOf('}}', m.indexOf('{{' + tag + '=[[') + 10) + 2);
    assert.ok(linha('critical').includes('?{Alvo aberrante? - Headsman') && linha('critical').includes('|Sim,1d10}'));
    assert.ok(!linha('damage').includes('aberrante') && !linha('damage').includes('2d6'));
    assert.ok(linha('critical').includes('+ 2d6 [Headsman'));
  });
});
t('efeitos: no máximo 5 perguntas por poder; o resto vira linha informativa', () => {
  const sete = Array.from({ length: 7 }, (_, i) => ef({ stat: 'damage', value: 1, bonusType: 'untyped', condition: `condicao ${i}`, conditionPt: `Condição ${i}?`, askable: true }));
  comBanco(sete, (p) => {
    const m = exportarRoll20(p, 'pt').poderes[0].macro;
    const linha = m.slice(m.indexOf('{{damage=[['), m.indexOf('}}', m.indexOf('{{damage=[[') + 10) + 2);
    assert.equal((linha.match(/\?\{/g) || []).length, 5);
    assert.match(m, /Condicionais \(não calculados\)[^}]*Condição 5[^}]*Condição 6/);
  });
});
console.log(`\n${n} testes passaram.`);
