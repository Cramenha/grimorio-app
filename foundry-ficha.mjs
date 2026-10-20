// Exporta a ficha para um Actor do Foundry VTT (sistema "dnd4e" de EndlesNights, usado pelo módulo
// foundry-4e-compendium). Gerado por import nativo de JSON do próprio Foundry (Import Data), sem extensão
// nem script de API. Schema conferido em 17 fichas de referência (D:\CLAUDE\GRIMÓRIO DO AVENTUREIRO\PARA FOUNDRY).
//
// Como funciona: os campos "value"/"base" das defesas, PV, perícias etc. são a BASE (ex.: defesas sempre
// começam em 10); o total que o Foundry mostra é base + ability + armour + class + feat + item + power +
// race + enhance + shield + untyped (cada "tipo" soma só o maior, sem tipo soma tudo). Em vez de reproduzir
// cada fonte de bônus do app numa dessas colunas, calculamos o total certo com calculo.mjs (já validado contra
// o Character Builder) e colocamos a diferença toda em "untyped" — o total final bate, só não aparece
// repartido por fonte como numa ficha nativa do sistema.
import * as comp from './compendio.mjs';
import { calcular, infoArma, infoArmadura, PERICIAS, PENALIZA } from './calculo.mjs';
import * as r20 from './roll20.mjs';
import { efeitosDaFicha } from './efeitos-ficha.mjs';

const mod = (n) => Math.floor((n - 10) / 2);
const ATR_FICHA = { for: 'str', con: 'con', des: 'dex', int: 'int', sab: 'wis', car: 'cha' };
const bi = (nome) => { const pt = nome && comp.nomePT(nome); return pt && pt.toLowerCase() !== nome.toLowerCase() ? `${nome} (${pt})` : (nome || ''); };
const nomeItem = (it) => (it.base && it.ench ? `${it.base.nome} · ${it.ench.nome}${it.ench.mais ? ' +' + it.ench.mais : ''}` : it.cat === 'item' && it.variante?.mais ? `${it.nome} +${it.variante.mais}` : it.nome);
const idFx = (() => { let n = 0; return () => (n++).toString(16).padStart(16, '0'); })(); // ids determinísticos, únicos no arquivo
// O compêndio sempre abre a entrada com <h1 class=player>Nome</h1> (ou class=mihead); dentro do Foundry isso
// renderiza enorme, e o nome já aparece no título do item — reduz para <h5> em vez de cortar (pedido do usuário).
const semH1 = (html) => String(html || '').replace(/<h1[^>]*>/gi, '<h5>').replace(/<\/h1>/gi, '</h5>');
const descDe = (cat, id, lang) => { const det = id && comp.detalhe(cat, id); if (!det) return ''; return semH1((lang === 'pt' && det.htmlPT) || det.html); };

// Mesma classificação de P.extras usada no export pro Character Builder (dnd4e-export.mjs): o internal-id do CB
// já embute a categoria no nome. Aqui só nos interessa separar o que é FEATURE DE VERDADE (classe/híbrido/raça)
// do que é só proficiência/bookkeeping (não vira item, já está refletido no profBonus da arma/armadura).
function tipoDeExtra(id) {
  const s = String(id || '').toUpperCase();
  if (s.includes('PROFICIENCY')) return 'Proficiency';
  if (s.includes('RACIAL_TRAIT')) return 'Racial Trait';
  if (s.includes('THEME_FEATURE')) return 'Theme Feature';
  if (s.includes('CLASS_FEATURE')) return 'Class Feature';
  if (s.includes('HYBRID_CLASS')) return 'Hybrid Class';
  if (s.includes('GRANTS')) return 'Grants';
  if (s.includes('BACKGROUND')) return 'Background Choice';
  if (s.includes('TRAIT_PACKAGE')) return 'Trait Package';
  if (s.includes('FAMILIAR')) return 'Familiar';
  return 'Internal';
}
// "Hybrid" sozinho não diz nada — pega os dois nomes reais em P.extras (ID_FMP_HYBRID_CLASS_*, sempre
// "Hybrid <Nome>") e monta "Cleric/Invoker". Personagem não-híbrido devolve o próprio nome, sem mudança.
function nomeClasseExport(P) {
  const n = P.classe?.nome || '';
  if (!/^hybrid$/i.test(n.trim())) return n;
  const h = (P.extras || []).filter((e) => tipoDeExtra(e.id) === 'Hybrid Class').map((e) => e.nome.replace(/^Hybrid\s+/i, ''));
  return h.length ? h.join('/') : n;
}

const bonus1 = () => [{ active: false }];
const DEF = { feat: 0, item: 0, power: 0, race: 0, untyped: 0, bonus: bonus1() };
const typedAttr = () => ({ value: 0, ...DEF });

// Divide o total de uma defesa em habilidade/armadura/classe/talento/aprimoramento/sobra (mesma técnica do Roll20).
// 'linhas' já vem SEM as que viraram ActiveEffect (ver particionar()); 'coberto' é a soma delas, só para o
// residual "class" não tentar compensar um bônus que já vai chegar por outro caminho (dobraria a conta).
function defesaFoundry(C, chave, habs, linhas, coberto) {
  const total = C[chave], meia = Math.floor(C.nivel / 2);
  let armour = 0, enhance = 0, feat = 0, untyped = 0;
  for (const l of linhas) {
    const t = (l.tipo || '').toLowerCase();
    if (t === 'armor' || t === 'shield') armour += l.valor; else if (t === 'enhancement') enhance += l.valor; else if (t === 'feat') feat += l.valor; else untyped += l.valor;
  }
  let hab = Math.max(...habs.map((a) => C.modificadores[a]));
  let classe = (total - coberto) - 10 - meia - hab - armour - enhance - feat - untyped;
  if (classe < 0 && chave === 'ac') { hab = 0; classe = (total - coberto) - 10 - meia - armour - enhance - feat - untyped; } // armadura pesada: sem bônus de atributo
  return { value: 10, ability: '', altability: '', armour, class: classe, feat, item: 0, power: 0, race: 0, untyped, enhance, shield: 0, bonus: bonus1(), temp: 0, light: 'auto', condition: 'Conditional Bonuses.', chat: `@name defends with ${chave}.` };
}

// ---------------------------------------------------------------- ActiveEffects por item (igual o Adran de referência)
// Em vez de só jogar a diferença num bucket único do ator, talento/raça/classe/item mágico cada um carrega seu
// próprio ActiveEffect com a mudança que concede (conferido lendo o Adran.json de referência e o Actor.prototype
// do sistema dnd4e real). Bônus de armadura/escudo ficam de fora (já tratados pelos campos do próprio item de
// equipamento); o que não bate com nenhum item exportado (ex.: "Ajuste manual") continua no bucket de sempre.
const TIPO_MUDANCA = { feat: { tipo: 'upgrade', bucket: 'feat' }, enhancement: { tipo: 'upgrade', bucket: 'enhance' }, racial: { tipo: 'upgrade', bucket: 'race' } };
function tipoDoBonus(tipo) { return TIPO_MUDANCA[(tipo || '').toLowerCase()] || { tipo: 'add', bucket: 'untyped' }; }
function novoEfeito(nome, changes) {
  return {
    _id: idFx(), name: nome, img: 'icons/svg/mystery-man.svg', flags: {}, disabled: false, type: 'base',
    system: { changes, durationType: '', powerEffectType: 'misc', dots: [], equippedRec: false, keywords: [], keywordsCustom: '', useSourceActorData: true, durationAction: '' },
    duration: { value: null, units: 'seconds', expiry: null, expired: false }, description: '', tint: '#ffffff', transfer: true, statuses: [], sort: 0, folder: null,
  };
}
// Tira o prefixo "Talento: "/"Classe: "/"Raça: " da fonte e acha o item exportado correspondente no registro.
function itemDaFonte(fonte, registro) {
  const semPrefixo = fonte.replace(/^(Talento|Classe|Raça): /, '');
  if (registro.has(fonte)) return registro.get(fonte);
  if (registro.has(semPrefixo)) return registro.get(semPrefixo);
  // compendio/efeitos.json guarda o nome GENÉRICO do talento ("Implement Expertise"), mas a ficha tem a escolha
  // entre parênteses ("Implement Expertise (Wand)") — acha o item cujo nome começa igual.
  for (const [nome, item] of registro) if (nome.startsWith(semPrefixo + ' (')) return item;
  return undefined;
}
// Separa as linhas de C.origem.<stat> em "cobertas" (viram ActiveEffect num item de verdade) e "restantes"
// (ficam no bucket do ator, igual já funcionava) — armadura/escudo NUNCA virou effect, já vem do próprio item.
function particionar(linhas, registro) {
  const cobertas = [], restantes = [];
  for (const l of linhas) {
    const t = (l.tipo || '').toLowerCase();
    const item = (t !== 'armor' && t !== 'shield') ? itemDaFonte(l.fonte, registro) : null;
    if (item) cobertas.push({ ...l, item }); else restantes.push(l);
  }
  return { cobertas, restantes, valorCoberto: cobertas.reduce((a, l) => a + l.valor, 0) };
}
// Bônus genéricos de ataque/dano que não vieram de nenhum item exportado (ex.: "Ajuste manual") — mesma ideia
// do defesaFoundry, mas para o modificador global (system.modifiers.attack/damage, sem "armour"/"enhance"/"class").
function modificadorGlobal(linhasRestantes) {
  let feat = 0, race = 0, item = 0, power = 0, untyped = 0;
  for (const l of linhasRestantes) {
    const t = (l.tipo || '').toLowerCase();
    if (t === 'feat') feat += l.valor; else if (t === 'racial') race += l.valor; else if (t === 'item' || t === 'enhancement') item += l.valor; else if (t === 'power') power += l.valor; else untyped += l.valor;
  }
  return { value: 0, class: 0, feat, item, power, race, untyped, bonus: bonus1() };
}
// "tipo: Ability" não é um bônus somado — é o REGRAS BASE marcando "para este cálculo, use o modificador
// desta outra habilidade em vez da de sempre" (ex.: Wary Fighter troca Destreza por Sabedoria na iniciativa).
// sumStat() já aplica isso como bucket tipado (só vale o maior), então o "valor" da linha É o próprio
// modificador da habilidade nova — não dá pra simplesmente somar em cima do mod. padrão (ex. Destreza) sem
// trocar: dobraria a conta errada. Vira OVERRIDE de system.<base>.ability; sem item pra prender o efeito,
// cai no fallback antigo (soma numérica, errado mas não pior que antes).
function trocaHabilidade(linhas, registro, C) {
  const restantes = [], swaps = [];
  for (const l of linhas) {
    if (l.tipo !== 'Ability') { restantes.push(l); continue; }
    const item = itemDaFonte(l.fonte, registro);
    // o nome da habilidade vem escrito no próprio texto da regra ("+Wisdom modifier") — ler o nome em vez de
    // adivinhar pelo valor numérico, que é ambíguo quando duas habilidades têm o mesmo modificador.
    const nomeEn = /(Strength|Constitution|Dexterity|Intelligence|Wisdom|Charisma)/i.exec(l.expr || '')?.[1];
    const abKeyPt = nomeEn && PT_DE_ABIL_EN[nomeEn.toLowerCase()];
    if (item && abKeyPt) swaps.push({ item, fonte: l.fonte, abKeyPt, ability: ATR_FICHA[abKeyPt] });
    else restantes.push(l);
  }
  return { restantes, swaps };
}
// Pega o valor certo pro nível do personagem numa escala [[nivel,valor],...] (ex.: Mighty Crusader Expertise
// é +1 no 1º nível, +2 no 11º, +3 no 21º). Sem escala, usa o valor fixo do próprio efeito.
function valorEscalado(e, nivel) {
  if (!e.scaling?.length) return e.value;
  return e.scaling.filter(([lv]) => lv <= nivel).sort((a, b) => a[0] - b[0]).at(-1)?.[1] ?? e.value;
}
// Bônus condicionais que o app já sabe extrair (compendio/efeitos.json: Mighty Crusader Expertise, Implement
// Expertise (X) etc.) — nenhum vira número automático (a condição muda a cada rolagem, ex. "empunhando arma de
// duas mãos?"), mas sem isto eles não apareciam em lugar nenhum no Foundry. Igual o Adran de referência faz com
// "Bow Expertise (Dano)"/"Icy Heart": entra como ActiveEffect DESLIGADO (disabled:true) no item que concede,
// pronto pra o jogador ligar na hora que a condição valer.
// Palavra-chave real do sistema (lida em utils.mjs: suitableKeywords vem de weaponData.properties/implement)
// pro texto da condição extraída do talento/item — "two-handed" -> "two" (properties.two), "holy symbol" ->
// "holyS" (implement.holyS) etc. Achando a palavra-chave, o Foundry aplica o bônus sozinho, sem toggle manual,
// só quando a arma/implemento em uso de verdade tiver essa propriedade/tipo.
const KEYWORD_COND = [[/two-handed/i, 'two'], [/off-hand/i, 'off'], [/holy symbol|símbolo sagrado/i, 'holyS'], [/\bwand\b|\bvarinha\b/i, 'wand'], [/\brod\b|\bbastão\b/i, 'rod'], [/\bstaff\b|\bcajado\b/i, 'staff'], [/\btotem\b/i, 'totem'], [/\borb\b|\borbe\b/i, 'orb'], [/\btome\b|\btomo\b/i, 'tome'], [/ki focus|foco de ki/i, 'ki']];
// a condição de verdade às vezes só está na "note" (ex.: a 2ª linha de Mighty Crusader Expertise diz "para
// ataques... com símbolo sagrado" só ali, condition/conditionPt vêm null) — procura nos três campos.
const keywordDaCondicao = (e) => KEYWORD_COND.find(([re]) => re.test(e.condition || '') || re.test(e.conditionPt || '') || re.test(e.note || ''))?.[1] || null;
function gerarEfeitosCondicionais(P, C, registro) {
  for (const e of efeitosDaFicha(P)) {
    const item = itemDaFonte(e.origem.nome, registro);
    if (!item) continue;
    const valor = valorEscalado(e, C.nivel);
    if (valor == null) continue;
    const { tipo, bucket } = tipoDoBonus(e.bonusType);
    const estat = e.stat === 'damage' ? 'damage' : 'attack';
    const kw = (e.appliesTo?.weaponOnly || e.appliesTo?.implementOnly) && keywordDaCondicao(e);
    const key = kw ? `weapon.${estat}.${kw}.${bucket}` : `system.modifiers.${estat}.${bucket}`;
    const nome = `${e.origem.nome} (${e.conditionPt || e.condition || (e.stat === 'damage' ? 'Dano' : 'Ataque')})`;
    const efeito = novoEfeito(nome, [{ key, value: valor, priority: null, type: tipo, phase: 'initial' }]);
    // achou a palavra-chave real da arma/implemento: o próprio Foundry só aplica quando ela bate, não precisa
    // de toggle manual. Sem palavra-chave (condição livre, ex. "Called Shot"), fica desligado pro jogador ligar.
    efeito.disabled = !kw;
    (item.effects = item.effects || []).push(efeito);
  }
}
function gerarEfeitosDeStat(cobertas, keyBase, nomeLabel) {
  for (const l of cobertas) {
    const { tipo, bucket } = tipoDoBonus(l.tipo);
    const efeito = novoEfeito(`${l.fonte} (${nomeLabel})`, [{ key: `${keyBase}.${bucket}`, value: l.valor, priority: null, type: tipo, phase: 'initial' }]);
    (l.item.effects = l.item.effects || []).push(efeito);
  }
}

// Mapas texto do compêndio (inglês) -> enums do sistema, conferidos nas 17 fichas de referência.
function tipoAcao(txt) {
  if (/interrupt/i.test(txt)) return 'interrupt';
  if (/reaction/i.test(txt)) return 'reaction';
  if (/opportunity/i.test(txt)) return 'opportunity';
  if (/free/i.test(txt)) return 'free';
  if (/minor/i.test(txt)) return 'minor';
  if (/move/i.test(txt)) return 'move';
  if (/standard/i.test(txt)) return 'standard';
  return 'none';
}
function tipoAlcance(alcance) {
  if (/close burst/i.test(alcance)) return 'closeBurst';
  if (/close blast/i.test(alcance)) return 'closeBlast';
  if (/\bweapon\b/i.test(alcance)) return 'weapon';
  if (/burst/i.test(alcance)) return 'rangeBurst';
  if (/wall/i.test(alcance)) return 'wall';
  if (/melee/i.test(alcance)) return 'melee';
  if (/ranged/i.test(alcance)) return 'range';
  if (/touch/i.test(alcance)) return 'touch';
  if (/personal/i.test(alcance)) return 'personal';
  return 'special';
}
function tipoArma(alcance, palavras) {
  const kw = palavras.join(' ').toLowerCase();
  if (/implement/.test(kw)) return 'implement';
  if (/ranged/i.test(alcance)) return 'ranged';
  if (/melee/i.test(alcance)) return 'melee';
  if (/\bweapon\b/.test(kw)) return 'any';
  return 'none';
}
const DEF_CAMPO = { AC: 'ac', Fort: 'fort', Ref: 'ref', Will: 'wil' };
const ABIL_EN = { Strength: 'str', Constitution: 'con', Dexterity: 'dex', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha' };
const PT_DE_ABIL_EN = { strength: 'for', constitution: 'con', dexterity: 'des', intelligence: 'int', wisdom: 'sab', charisma: 'car' };
const TIPOS_DANO_SYS = ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'];

// Lê o poder do compêndio (mesmo texto que gera a macro do Roll20) e monta o item "power" do Foundry.
function itemPower(w, lang) {
  const det = comp.detalhe('power', w.id);
  if (!det) return null;
  const en = r20.analisar(det.html);
  let pt = lang === 'pt' && det.htmlPT ? r20.analisar(det.htmlPT) : null;
  if (pt && pt.campos.length !== en.campos.length) pt = null;
  const T = pt || en;
  const campo = (rot) => en.campos.find((c) => c.rotulo.toLowerCase() === rot);
  const campoT = (rot) => T.campos.find((c) => c.rotulo.toLowerCase() === rot) || campo(rot);
  const cAtaque = campo('attack') || campo('primary attack');
  const cHit = campo('hit');
  const ataque = cAtaque && r20.lerAtaque(cAtaque.texto);
  const dano = cHit && r20.lerDano(cHit.texto);
  const palavrasExtra = en.palavrasExtra || [];
  const weaponType = tipoArma(en.alcance, [...en.palavras, ...palavrasExtra]);
  const useType = /at-?will/i.test(en.tipo) ? 'atwill' : /daily/i.test(en.tipo) ? 'daily' : /encounter/i.test(en.tipo) ? 'encounter' : 'other';
  const damageType = {};
  if (dano?.tipo) { const t = TIPOS_DANO_SYS.find((x) => x === dano.tipo.toLowerCase()); if (t) damageType[t] = true; else damageType.physical = true; } else if (dano) damageType.physical = true;
  const descricao = semH1((pt ? det.htmlPT : det.html) || det.html);
  return {
    _id: idFx(), name: bi(det.meta.Name), type: 'power', img: '', effects: [], folder: null, sort: 0, flags: {},
    system: {
      description: { value: descricao, chat: '', unidentified: '', gm: '' }, descriptionGM: { value: '' },
      source: { custom: '', revision: 1 }, activation: { type: '', cost: 0, condition: '' }, duration: { value: null, units: '' },
      target: (campoT('target') || campoT('primary target'))?.texto || '', range: { value: null, long: null, units: '' },
      uses: { value: 0, max: '0', per: '' }, consume: { type: '', target: '', amount: null },
      attack: { shareAttackRoll: false, isAttack: !!ataque, isBasic: false, isCharge: false, isOpp: false, canCharge: false, canOpp: false, ability: ataque ? ABIL_EN[ataque.atributo] || '' : '', abilityBonus: 0, def: ataque ? DEF_CAMPO[ataque.defesa] || '' : '', defBonus: 0, detail: '', formula: ataque ? (weaponType === 'implement' ? '@impAttack + @powerMod + @lvhalf' : '@wepAttack + @powerMod + @lvhalf') : '' },
      hit: { shareDamageRoll: false, damageBonusNull: false, isDamage: !!dano, isHealing: false, healSurge: '', baseQuantity: dano ? String(dano.qtd) : '', baseDiceType: dano ? (dano.arma ? 'weapon' : [4, 6, 8, 10].includes(dano.lados) ? 'd' + dano.lados : 'flat') : '', detail: cHit ? campoT('hit').texto : '', formula: dano ? '@powBase + @powerMod + @wepDamage' : '', critFormula: dano ? '@powMax + @powerMod + @wepDamage + @wepCritBonus' : '', healFormula: '' },
      miss: { detail: campoT('miss')?.texto || '', formula: '', halfDamage: false },
      effect: { detail: campoT('effect')?.texto || '' }, damage: { parts: [] }, damageCrit: { parts: [] }, damageCritImp: { parts: [] },
      damageType: Object.fromEntries(['damage', ...TIPOS_DANO_SYS, 'physical'].map((k) => [k, !!damageType[k]])),
      keyWords: T.palavras, level: w.nivel || null, powersource: '', secondPowersource: '', powersourceName: '', subName: '',
      prepared: true, powerType: 'class', powerSubtype: ataque ? 'attack' : 'utility', useType, actionType: tipoAcao(en.acao),
      requirements: campoT('requirement')?.texto || '', weaponType, weaponUse: weaponType === 'none' ? 'none' : 'default',
      rangeType: tipoAlcance(en.alcance), autoTarget: { mode: 'none', includeSelf: true }, rangeTextShort: '', rangeText: T.alcance,
      rangePower: '', area: '0', rechargeRoll: '', rechargeCondition: '', damageShare: false, postEffect: true, postSpecial: true,
      autoGenChatPowerCard: false, sustain: { actionType: '', detail: '' }, trigger: campoT('trigger')?.texto || '',
      requirement: campoT('requirement')?.texto || '', special: campoT('special')?.texto || '', specialAdd: { parts: [] },
      effectType: {}, keywordsCustom: '', auraSize: '', damageMiss: { parts: [] }, chatFlavor: '', effectHTML: false,
      identifier: String(det.meta.Name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-'),
      macros: [{ type: 'script', scope: 'global', launchOrder: 'off', command: '', author: '', enabled: true }], autoanimationsHook: '',
    },
  };
}

function itemTalento(t, lang) {
  const html = descDe('feat', t.id, lang);
  return {
    _id: idFx(), name: bi(t.nome), type: 'feature', img: 'icons/svg/mystery-man.svg', effects: [], folder: null, sort: 0, flags: {},
    system: {
      description: { value: html || `<p>${t.nome}</p>`, chat: '', unidentified: '', gm: '' }, descriptionGM: { value: '' },
      source: { custom: '', revision: 1 }, featureType: 'feat', level: null, requirements: '', featureSource: '', featureGroup: '',
      auraSize: '', effectType: {}, damageType: {}, keywordsCustom: '', identifier: '', macros: [], autoanimationsHook: '',
    },
  };
}

// race/classe/caminho paragonal/destino épico/tema/antecedente: busca a descrição real no compêndio pelo id
// (quando a ficha tem um; "Hybrid" não tem id de classe no compêndio, fica só com o nome mesmo).
function itemFeature(nome, tipo, cat, id, lang) {
  const html = descDe(cat, id, lang);
  return {
    _id: idFx(), name: bi(nome), type: 'feature', img: 'icons/svg/mystery-man.svg', effects: [], folder: null, sort: 0, flags: {},
    system: { description: { value: html || `<p>${nome}</p>`, chat: '', unidentified: '', gm: '' }, descriptionGM: { value: '' },
      source: { custom: '', revision: 1 }, featureType: tipo, level: null, requirements: '', featureSource: '', featureGroup: '',
      auraSize: '', effectType: {}, damageType: {}, keywordsCustom: '', identifier: '', macros: [], autoanimationsHook: '' },
  };
}

// Armas e implementos equipados (ou não) do inventário. attackForm/damageDice são os campos que o item usa
// nas próprias contas (ex.: na macro do poder, @wepAttack vem do attackForm da arma equipada).
function itemArma(it, lang) {
  // Itens soltos (cat 'item') cujo ref aponta pra uma arma/implemento de verdade (ex.: "Iron Wand" equipado,
  // sem base/encantamento separados) também contam como arma — senão perdem profBonus/enhance/damageDice e
  // nenhum poder de implemento consegue usá-los.
  const baseRef = it.base?.id ? { cat: it.cat === 'implement' ? 'implement' : 'weapon', id: it.base.id } : (it.ref?.id && ['weapon', 'implement'].includes(it.ref.cat) ? it.ref : null);
  const w = baseRef && infoArma(baseRef.cat, baseRef.id);
  if (!w) return null;
  const d = /(\d+)d(\d+)/.exec(w.dano || '') || [, '1', '6'];
  const mais = it.ench?.mais || it.variante?.mais || 0;
  const desc = [descDe(baseRef.cat, baseRef.id, lang), it.ench?.id && descDe(it.ench.cat || 'item', it.ench.id, lang)].filter(Boolean).join('<hr>') || `<p>${it.nome}</p>`;
  // "weapon.attack.two.feat"/"weapon.attack.holyS.feat" etc. (confirmado lendo utils.mjs do sistema real):
  // o Foundry só aplica esses efeitos condicionais quando a arma/implemento TEM a propriedade/tipo certo —
  // "two" vem de properties.two, os tipos de implemento vêm do grupo (Wand/Rod/Staff/Totem/Orb/Tome/Holy
  // Symbol/Ki Focus). Sem isso, Mighty Crusader Expertise/Implement Expertise nunca teriam onde "pegar".
  const duasMaos = /two-handed/i.test(w.texto || '');
  const TIPO_IMPL = { wand: 'wand', rod: 'rod', staff: 'staff', totem: 'totem', orb: 'orb', tome: 'tome', 'holy symbol': 'holyS', 'ki focus': 'ki' };
  const tipoImpl = TIPO_IMPL[w.grupo];
  return {
    _id: idFx(), name: bi(nomeItem(it)), type: 'weapon', img: '', effects: [], folder: null, sort: 0, flags: {},
    system: {
      description: { value: desc, chat: '', unidentified: '', gm: '' }, descriptionGM: { value: '' }, source: { custom: '', revision: 1 },
      quantity: it.qtd || 1, weight: 0, price: it.custo || 0, attuned: false, equipped: !!it.equipado, rarity: '', identified: true, container: null,
      activation: { type: '', cost: 0, condition: '' }, duration: { value: null, units: '' }, target: { value: null, width: null, units: '', type: '' },
      range: { value: w.distancia ? 10 : null, long: w.distancia ? 20 : null }, uses: { value: 0, max: '0', per: '' }, consume: { type: '', target: '', amount: null },
      armour: { value: 10 }, hp: { value: 0, max: 0, dt: null, conditions: '' },
      level: it.variante?.nivel || it.ench?.nivel || null,
      weaponType: baseRef.cat === 'implement' ? 'implement' : w.mundana ? (w.distancia ? 'simpleR' : 'simpleM') : (w.distancia ? 'militaryR' : 'militaryM'),
      weaponHand: 'hMain', properties: { two: duasMaos }, proficient: w.prof > 0 ? 'yes' : 'no', proficientI: false, profBonus: w.prof || 0, profImpBonus: 0, enhance: mais,
      isRanged: !!w.distancia, damageDice: { parts: [{ numDice: d[1], numFaces: d[2], modifier: '' }] }, damage: { parts: [] }, damageCrit: { parts: [] },
      damageImp: { parts: [] }, damageCritImp: { parts: [] }, damageType: { physical: true }, brutalNum: null,
      weaponGroup: {}, attackForm: '@profBonus + @enhance', attackFormImp: '@profImpBonus + @enhanceImp',
      // damageForm é constante nas 17 fichas de referência; critDamageForm varia por arma, mas "(@enhance)d6"
      // é o que as próprias referências usam quando não têm um bônus de crítico fixo no texto (escala com o nível do item).
      damageForm: '@enhance', damageFormImp: '@enhance', critDamageForm: '(@enhance)d6', critDamageFormImp: '(@enhance)d6',
      critRange: 20, critRangeImp: 20, weaponBaseType: '', weaponBaseTypeCustom: '', damageTypeOverride: '',
      implement: { holyS: tipoImpl === 'holyS', ki: tipoImpl === 'ki', orb: tipoImpl === 'orb', rod: tipoImpl === 'rod', staff: tipoImpl === 'staff', tome: tipoImpl === 'tome', totem: tipoImpl === 'totem', wand: tipoImpl === 'wand' },
      identifier: '', macros: [{ type: 'script', scope: 'global', launchOrder: 'off', command: '', author: '', enabled: true }], itemPowers: [], autoanimationsHook: '',
    },
  };
}

// Armadura/escudo (type:'armour', subtype cloth/light/heavy) e itens mágicos soltos (type:'other', nunca
// 'armour' — item solto com armour.type default "armour" tira -2 de Reflexo por "não ser proficiente").
const SUB_ARMADURA = { cloth: 'cloth', leather: 'light', hide: 'light', chain: 'heavy', scale: 'heavy', plate: 'heavy', heavy: 'heavy', light: 'light' };
function itemEquipamento(it, lang) {
  const ar = it.cat === 'armor' && it.base?.id && infoArmadura(it.base.id);
  const mais = it.ench?.mais || 0;
  const souArmadura = !!ar;
  const desc = [it.cat === 'armor' && it.base?.id && descDe(it.cat, it.base.id, lang), it.ench?.id ? descDe(it.ench.cat || 'item', it.ench.id, lang) : (it.ref?.id && descDe(it.ref.cat || 'item', it.ref.id, lang))].filter(Boolean).join('<hr>') || `<p>${it.nome}</p>`;
  return {
    _id: idFx(), name: bi(nomeItem(it)), type: 'equipment', img: '', effects: [], folder: null, sort: 0, flags: {},
    system: {
      description: { value: desc, chat: '', unidentified: '', gm: '' }, descriptionGM: { value: '' }, source: { custom: '', revision: 1 },
      quantity: it.qtd || 1, weight: 0, price: it.custo || 0, attuned: false, equipped: !!it.equipado, rarity: '', identified: true, container: null,
      activation: { type: '', cost: 0, condition: '' }, duration: { value: null, units: '' }, target: { value: null, width: null, units: '', type: '' },
      range: { value: null, long: null, units: '' }, uses: { value: 0, max: '0', per: '' }, consume: { type: '', target: '', amount: null },
      level: it.variante?.nivel || it.ench?.nivel || null,
      // armour.ac/fort/ref/wil ficam em 0 de propósito: Actor.calcDefenceStatsCharacter (conferido no código real do
      // sistema) já soma esses campos do item equipado por conta própria (def.armour += item.system.armour[id]),
      // por cima do que a gente mesmo põe em defences.X.armour via calculo.mjs — somar os dois dobra o bônus de CA.
      // Escudo usa type:'arms' (não 'armour'): é a única forma que o sistema reconhece como escudo de verdade.
      armour: { type: souArmadura ? (ar.escudo ? 'arms' : 'armour') : 'other', enhance: mais, ac: 0, fort: 0, ref: 0, wil: 0, dex: null,
        movePen: false, movePenValue: 0, skillCheck: false, skillCheckValue: 0, damageRes: { parts: [] }, subtype: souArmadura ? (SUB_ARMADURA[ar.tipo] || 'other') : '' },
      speed: { value: souArmadura ? ar.velocidade || null : null, conditions: '' }, strength: 0, stealth: false,
      proficient: 'yes', armourBaseType: '', identifier: '', macros: [], itemPowers: [], armourBaseTypeCustom: '', shieldBaseType: '', shieldBaseTypeCustom: '', autoanimationsHook: '',
    },
  };
}

export function exportarFoundry(P, lang = 'pt') {
  if (P.tipo === 'criatura') throw new Error('Criaturas ainda não exportam para o Foundry.');
  const C = calcular(P);
  const meia = Math.floor(C.nivel / 2);
  const avisos = [];

  const abilities = {};
  for (const [pt, en] of Object.entries(ATR_FICHA)) abilities[en] = { value: C.atributos[pt], chat: '@name uses @label.', check: { feat: 0, item: 0, power: 0, race: 0, untyped: 0, value: 0, bonus: [] } };

  const pvAtual = P.pvAtual === '' || P.pvAtual == null ? C.pv : +P.pvAtual;
  const surtosAtuais = P.surtosAtuais === '' || P.surtosAtuais == null ? C.surtos : +P.surtosAtuais;

  const COD_PER = { Acrobatics: 'acr', Arcana: 'arc', Athletics: 'ath', Bluff: 'blu', Diplomacy: 'dip', Dungeoneering: 'dun', Endurance: 'end', Heal: 'hea', History: 'his', Insight: 'ins', Intimidate: 'itm', Nature: 'nat', Perception: 'prc', Religion: 'rel', Stealth: 'stl', Streetwise: 'stw', Thievery: 'thi' };

  // registro: nome (sem prefixo de fonte) -> item exportado, usado logo abaixo para anexar os ActiveEffects
  // de talento/raça/classe/caminho/destino/tema/antecedente/item mágico no item certo (ver particionar()).
  const items = [], registro = new Map();
  const add = (nome, it) => { if (nome) registro.set(nome, it); return it; };
  for (const w of (P.poderes || []).filter((x) => x.id)) {
    try { const it = itemPower(w, lang); if (it) items.push(it); } catch (e) { avisos.push(`${w.nome}: ${e.message}`); }
  }
  for (const t of (P.talentos || []).filter((x) => x.id)) items.push(add(t.nome, itemTalento(t, lang)));
  for (const t of (P.talentos || []).filter((x) => !x.id)) items.push(add(t.nome, itemFeature(t.nome, 'feat')));
  if (P.raca?.nome) items.push(add(P.raca.nome, itemFeature(P.raca.nome, 'race', 'race', P.raca.id, lang)));
  const nomeClasse = nomeClasseExport(P);
  if (P.classe?.nome) items.push(add(P.classe.nome, itemFeature(nomeClasse, 'class', 'class', P.classe.id, lang)));
  // Características de classe/raça vindas do .dnd4e (P.extras): cada uma entra como item próprio, registrada
  // pelo nome dela — é assim que calculo.mjs marca a fonte (ex. "Battle Cleric's Lore"), então sem isto os
  // bônus dessas características caíam todos juntos no bucket "Classe: Hybrid" genérico, sem detalhe nenhum.
  // Proficiência e "Grants"/"Internal" não entram: já estão refletidos no profBonus de arma/armadura.
  const vistoExtra = new Set((P.poderes || []).map((w) => w.nome));
  const FEATURE_TYPE_EXTRA = { 'Racial Trait': 'race', 'Theme Feature': 'theme', 'Background Choice': 'background' };
  for (const x of P.extras || []) {
    const tipo = tipoDeExtra(x.id);
    if (!['Class Feature', 'Hybrid Class', 'Racial Trait', 'Theme Feature', 'Background Choice'].includes(tipo)) continue;
    if (vistoExtra.has(x.nome) || registro.has(x.nome)) continue; // já é poder, ou já foi exportado por outro caminho
    vistoExtra.add(x.nome);
    items.push(add(x.nome, itemFeature(x.nome, FEATURE_TYPE_EXTRA[tipo] || 'class')));
  }
  if (P.paragon?.nome) items.push(add(P.paragon.nome, itemFeature(P.paragon.nome, 'path', 'paragonpath', P.paragon.id, lang)));
  if (P.destino?.nome) items.push(add(P.destino.nome, itemFeature(P.destino.nome, 'destiny', 'epicdestiny', P.destino.id, lang)));
  if (P.tema?.nome) items.push(add(P.tema.nome, itemFeature(P.tema.nome, 'theme', 'theme', P.tema.id, lang)));
  if (P.antecedente?.nome) items.push(add(P.antecedente.nome, itemFeature(P.antecedente.nome, 'background', 'background', P.antecedente.id, lang)));
  for (const it of P.itens || []) {
    const mais = it.ench?.mais || it.variante?.mais || 0;
    const fonteItem = it.ench?.nome ? `${it.ench.nome}${mais ? ' +' + mais : ''}` : `${it.nome}${mais ? ' +' + mais : ''}`;
    const ehArma = it.cat === 'weapon' || it.cat === 'implement' || (it.cat === 'item' && ['weapon', 'implement'].includes(it.ref?.cat));
    if (ehArma) {
      const x = itemArma(it, lang); if (x) items.push(add(fonteItem, x)); else avisos.push(`"${nomeItem(it)}" sem correspondência no compêndio; não incluído.`);
    } else items.push(add(fonteItem, itemEquipamento(it, lang)));
  }

  // ActiveEffects reais (igual o Adran de referência) para as linhas de C.origem que batem com um item exportado;
  // o que não bate (ex.: "Ajuste manual") continua entrando direto no bucket do ator, exatamente como antes.
  gerarEfeitosCondicionais(P, C, registro);
  const PAC = particionar(C.origem.ac.filter((x) => x.aplicado), registro); gerarEfeitosDeStat(PAC.cobertas, 'system.defences.ac', 'CA');
  const PFORT = particionar(C.origem.fort.filter((x) => x.aplicado), registro); gerarEfeitosDeStat(PFORT.cobertas, 'system.defences.fort', 'Fortitude');
  const PREF = particionar(C.origem.ref.filter((x) => x.aplicado), registro); gerarEfeitosDeStat(PREF.cobertas, 'system.defences.ref', 'Reflexo');
  const PVONT = particionar(C.origem.vont.filter((x) => x.aplicado), registro); gerarEfeitosDeStat(PVONT.cobertas, 'system.defences.wil', 'Vontade');
  const PVEL = particionar(C.origem.velocidade.filter((x) => x.aplicado && !/^Armadura/i.test(x.fonte)), registro); gerarEfeitosDeStat(PVEL.cobertas, 'system.movement.base', 'Deslocamento');
  const trocaIni = trocaHabilidade(C.origem.iniciativa.filter((x) => x.aplicado), registro, C);
  for (const s of trocaIni.swaps) (s.item.effects = s.item.effects || []).push(novoEfeito(`${s.fonte} (Iniciativa usa ${s.ability})`, [{ key: 'system.attributes.init.ability', value: s.ability, priority: null, type: 'override', phase: 'initial' }]));
  const habIni = trocaIni.swaps.at(-1)?.abKeyPt || 'des'; // última troca vale (é OVERRIDE); sem troca, segue Destreza de sempre
  const PINI = particionar(trocaIni.restantes, registro); gerarEfeitosDeStat(PINI.cobertas, 'system.attributes.init', 'Iniciativa');
  const PATK = particionar(C.origem.ataque.filter((x) => x.aplicado), registro); gerarEfeitosDeStat(PATK.cobertas, 'system.modifiers.attack', 'Ataque');
  const PDANO = particionar(C.origem.dano.filter((x) => x.aplicado), registro); gerarEfeitosDeStat(PDANO.cobertas, 'system.modifiers.damage', 'Dano');
  // PV/1º nível e PV/nível usam OVERRIDE (igual a classe de referência faz): só o mais recente/forte vale, por
  // isso só gera efeito se achar UMA fonte; "Healing Surges" é ADD (pode ter mais de uma fonte somando).
  const PV1 = particionar(C.origem.pv1.filter((x) => x.aplicado), registro);
  const PVN = particionar(C.origem.pvn.filter((x) => x.aplicado), registro);
  for (const l of PV1.cobertas) (l.item.effects = l.item.effects || []).push(novoEfeito(`${l.fonte} (PV/1º nível)`, [{ key: 'system.attributes.hp.starting', value: l.valor, priority: null, type: 'override', phase: 'initial' }]));
  for (const l of PVN.cobertas) (l.item.effects = l.item.effects || []).push(novoEfeito(`${l.fonte} (PV/nível)`, [{ key: 'system.attributes.hp.perlevel', value: l.valor, priority: null, type: 'override', phase: 'initial' }]));
  const PSURGE = particionar(C.origem.surtos.filter((x) => x.aplicado), registro);
  for (const l of PSURGE.cobertas) (l.item.effects = l.item.effects || []).push(novoEfeito(`${l.fonte} (Pulsos de cura)`, [{ key: 'system.details.surges.max', value: l.valor, priority: null, type: 'add', phase: 'initial' }]));

  const skills = {};
  for (const [nome, ab] of PERICIAS) {
    const cod = COD_PER[nome]; if (!cod) continue;
    const tr = P.pericias?.[nome]?.treinada ? 5 : 0;
    const base = mod(C.atributos[ab]) + meia + tr;
    const PP = particionar((C.origem.pericias[nome] || []).filter((x) => x.aplicado), registro);
    gerarEfeitosDeStat(PP.cobertas, `system.skills.${cod}`, comp.nomePT(nome) || nome);
    skills[cod] = { value: 0, base: 0, feat: 0, item: 0, power: 0, training: tr, race: 0, untyped: C.pericias[nome] - base - PP.valorCoberto, bonus: bonus1(), ability: ATR_FICHA[ab], armourCheck: PENALIZA.has(nome), chat: '@name uses @label.' };
  }

  const defences = {
    ac: defesaFoundry(C, 'ac', ['des', 'int'], PAC.restantes, PAC.valorCoberto), fort: defesaFoundry(C, 'fort', ['for', 'con'], PFORT.restantes, PFORT.valorCoberto),
    ref: defesaFoundry(C, 'ref', ['des', 'int'], PREF.restantes, PREF.valorCoberto), wil: defesaFoundry(C, 'vont', ['sab', 'car'], PVONT.restantes, PVONT.valorCoberto),
  };
  defences.ac.altability = 'dex'; // CA soma Destreza ou Inteligência automaticamente; as outras não têm "altability".

  const velArm = C.origem.velocidade.filter((l) => /^Armadura/i.test(l.fonte)).reduce((a, l) => a + l.valor, 0);
  const velItem = PVEL.restantes.filter((l) => (l.tipo || '').toLowerCase() === 'item').reduce((a, l) => a + l.valor, 0);
  const movFormula = (f) => ({ value: 0, formula: f, bonus: bonus1(), feat: 0, item: 0, power: 0, race: 0, untyped: 0, temp: 0, traits: '' });

  const actor = {
    // Sem prototypeToken: um objeto parcial quebra a validação do Token no Foundry v14 (falta campos como
    // "ring"/"turnMarker"/"depth"); sem a chave, o import preserva o token que a ficha de destino já tinha.
    name: P.nome || 'Personagem', type: 'Player Character', img: P.retrato || '', folder: null, ownership: { default: 0 }, flags: {},
    items, effects: [],
    system: {
      biography: '', abilities,
      details: {
        size: 'med', origin: 'natural', type: 'humanoid', other: '', race: bi(P.raca?.nome) || '', age: P.idade || '', gender: P.genero || '', height: P.altura || '',
        weight: P.peso || '', alignment: P.tendencia || '', deity: bi(P.divindade?.nome) || '', level: C.nivel, tier: C.nivel >= 21 ? 3 : C.nivel >= 11 ? 2 : 1, exp: P.xp || 0,
        bloodied: 0, surgeValue: 0, surgeBon: { bonus: bonus1(), feat: 0, item: 0, power: 0, race: 0, untyped: 0, value: 0 },
        surges: { value: surtosAtuais, feat: 0, item: 0, power: 0, race: 0, untyped: 0, max: C.surtos - PSURGE.valorCoberto },
        surgeEnv: { bonus: bonus1(), feat: 0, item: 0, power: 0, race: 0, untyped: 0, value: 0 }, saves: { bonus: bonus1(), feat: 0, item: 0, power: 0, race: 0, untyped: 0, value: 0 },
        class: nomeClasse || '', paragon: bi(P.paragon?.nome) || '', epic: bi(P.destino?.nome) || '', deathsaves: 3, deathsavefail: 0, deathsaveCrit: 20,
        deathsavebon: { bonus: bonus1(), feat: 0, item: 0, power: 0, race: 0, untyped: 0, value: 0 },
      },
      languages: { spoken: { value: (P.idiomas || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean), custom: '' }, script: { value: [], custom: '' } },
      senses: { special: { bs: { value: false, range: null }, dv: { value: false, range: null }, tr: { value: false, range: null }, ts: { value: false, range: null } }, notes: '', allAround: false, custom: '', basic: 'nv' },
      attributes: {
        // max = perlevel*(nivel-1) + starting + misc + @abilities.con.value + feat+item+power+race+untyped
        // (confirmado lendo Actor.prototype._prepareDerivedDataHitPointAutoCalc no Foundry real) — por isso
        // tiramos a Constituição do total certo antes de colocar a diferença em "untyped", senão soma 2x.
        hp: { value: pvAtual, min: 0, max: 10, starting: 0, perlevel: 0, feat: 0, item: 0, power: 0, race: 0, untyped: C.pv - C.atributos.con - PV1.valorCoberto - PVN.valorCoberto * (C.nivel - 1), misc: 0, autototal: true, temprest: false },
        temphp: { value: 0, max: 10 },
        init: { value: 0, ability: 'dex', bonus: bonus1(), feat: 0, item: 0, power: 0, race: 0, untyped: C.iniciativa - mod(C.atributos[habIni]) - meia - PINI.valorCoberto, notes: '' },
      },
      defences,
      modifiers: { attack: modificadorGlobal(PATK.restantes), damage: modificadorGlobal(PDANO.restantes), skills: { value: 0, class: 0, feat: 0, item: 0, power: 0, race: 0, untyped: 0, bonus: bonus1() }, defences: { value: 0, class: 0, feat: 0, item: 0, power: 0, race: 0, untyped: 0, bonus: bonus1() } },
      skills, skillTraining: { untrained: { value: 0, feat: 0, item: 0, power: 0, race: 0, untyped: 0 }, trained: { value: 5, feat: 0, item: 0, power: 0, race: 0, untyped: 0 }, expertise: { value: 8, feat: 0, item: 0, power: 0, race: 0, untyped: 0 } },
      passive: { pasprc: { value: 0, feat: 0, item: 0, power: 0, race: 0, untyped: 0, skill: 'prc', bonus: bonus1() }, pasins: { value: 0, feat: 0, item: 0, power: 0, race: 0, untyped: 0, skill: 'ins', bonus: bonus1() } },
      resistances: Object.fromEntries(['damage', 'physical', 'ongoing', ...TIPOS_DANO_SYS].map((k) => [k, { value: 0, res: 0, vuln: 0, armour: 0, immune: false, bonus: bonus1() }])),
      untypedResistances: { resistances: [], vulnerabilities: [], immunities: [] },
      commonAttackBonuses: {}, marker: null,
      currency: { ad: 0, pp: 0, gp: P.ouro || 0, sp: 0, cp: 0 },
      ritualcomp: { ar: 0, ms: 0, rh: 0, si: 0, rs: 0 },
      movement: { base: { value: 0, base: C.velocidade - velArm - velItem - PVEL.valorCoberto, armour: velArm, bonus: bonus1(), feat: 0, item: velItem, power: 0, race: 0, untyped: 0, temp: 0 },
        walk: movFormula('@base + @armour'), charge: movFormula('@base + @armour'), run: movFormula('@base + @armour + 2'),
        climb: movFormula('(@base + @armour)/2'), shift: movFormula('1'), swim: movFormula('(@base + @armour)/2'),
        burrow: movFormula(''), fly: movFormula(''), teleport: movFormula(''), notes: '', custom: '', ignoredDifficultTerrain: [], fullSqueeze: false, fullCrawl: false },
      resources: { primary: { value: 0, max: null, sr: false, lr: false, label: '' }, secondary: { value: 0, max: null, sr: false, lr: false, label: '' }, tertiary: { value: 0, max: null, sr: false, lr: false, label: '' } },
      magicItemUse: { perDay: 0, bonusValue: 0, milestone: 0, dailyuse: 0, encounteruse: false },
      encumbrance: { value: null, max: null, formulaNorm: '@abilities.str.value * 10', formulaHeavy: '@abilities.str.value * 20', formulaMax: '@abilities.str.value * 50', encumbered: false },
      powerGroupTypes: 'usage', powerSortTypes: 'az', featureSortTypes: 'az', ritualSortTypes: 'az', inventorySortTypes: 'az',
      actionpoints: { value: 1, encounteruse: false, effects: '', notes: '', custom: '' },
    },
  };
  return { json: actor, avisos };
}
