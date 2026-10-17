// Exportação no formato do Character Builder (.dnd4e, XML). Faz o caminho inverso de importar.mjs.
// O CB refaz a ficha a partir da lista de elementos de regra (RulesElementTally) pelos "internal-id"; os ids vêm de
// compendio\cb-ids.json (extrair-cb-ids.mjs). O que não tiver id conhecido vai para os avisos e, quando possível, para as notas.
import fs from 'node:fs';
import path from 'node:path';
import { COMPENDIO } from './caminhos.mjs';
import { calcular } from './calculo.mjs';
import * as comp from './compendio.mjs';

let IDS = {};
try { IDS = JSON.parse(fs.readFileSync(path.join(COMPENDIO, 'cb-ids.json'), 'utf8')); } catch { /* sem tabela */ }

const PERICIAS = ['Acrobatics', 'Arcana', 'Athletics', 'Bluff', 'Diplomacy', 'Dungeoneering', 'Endurance', 'Heal', 'History',
  'Insight', 'Intimidate', 'Nature', 'Perception', 'Religion', 'Stealth', 'Streetwise', 'Thievery'];
const ATR = [['for', 'Strength', 'str', 'Strength modifier'], ['con', 'Constitution', 'con', 'Constitution modifier'], ['des', 'Dexterity', 'dex', 'Dexterity modifier'],
  ['int', 'Intelligence', 'int', 'Intelligence modifier'], ['sab', 'Wisdom', 'wis', 'Wisdom modifier'], ['car', 'Charisma', 'cha', 'Charisma modifier']];
// categoria do app -> tipo do CB e prefixo do id (o número do iws é o mesmo do CB nestas categorias)
const CAT = {
  race: ['Race', 'ID_FMP_RACE_'], class: ['Class', 'ID_FMP_CLASS_'], paragonpath: ['Paragon Path', 'ID_FMP_PARAGON_PATH_'],
  epicdestiny: ['Epic Destiny', 'ID_FMP_EPIC_DESTINY_'], theme: ['Theme', 'ID_FMP_THEME_'], background: ['Background', 'ID_FMP_BACKGROUND_'],
  deity: ['Deity', 'ID_FMP_DEITY_'], feat: ['Feat', 'ID_FMP_FEAT_'], power: ['Power', 'ID_FMP_POWER_'],
};

const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
// caracteres que XML 1.0 não aceita
const limpa = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const idDe = (tipo, nome) => IDS[`${tipo}|${String(nome).toLowerCase()}`];
const num = (id) => (/(\d+)$/.exec(String(id || '')) || [])[1];
const TIER = { 1: 'heroic', 11: 'paragon', 21: 'epic' };

// "charelem" é um id de INSTÂNCIA (diferente do internal-id, que é o id global do elemento de regra):
// o Character Builder dá um valor hex de 8 dígitos único pra cada escolha daquele personagem específico.
// Sem esse atributo, qualquer leitor que monte um dicionário {charelem: nome} (como o importador do
// módulo do Foundry) quebra na primeira linha, porque tenta ler .nodeValue de um atributo que não existe.
let seqCharelem = 0;
const charelem = () => (++seqCharelem).toString(16).padStart(8, '0');

function elemento(nome, tipo, id, url = '') {
  return `<RulesElement name="${x(nome)}" type="${x(tipo)}" internal-id="${x(id)}"${url ? ` url="${x(url)}"` : ''} charelem="${charelem()}" legality="rules-legal" />`;
}

// P.extras guarda uma lista achatada (importar.mjs junta 10 tipos num só array, perdendo qual era qual) de
// coisas como proficiências, características de classe/raça e "grants" internos. O próprio nome do
// internal-id do Character Builder já denuncia a categoria original (é assim que o CB nomeia cada uma),
// então dá pra recuperar sem precisar guardar o tipo à parte. Sem isso, quem importa o .dnd4e (inclusive o
// importador do módulo do Foundry) nunca sabe a proficiência de arma/armadura do personagem e sempre acha
// "não proficiente" — e perde as características de classe/raça inteiras.
function tipoDeExtra(id) {
  const s = String(id || '').toUpperCase();
  if (s.includes('PROFICIENCY')) return 'Proficiency';
  if (s.includes('RACIAL_TRAIT')) return 'Racial Trait';
  if (s.includes('THEME_FEATURE') || s.includes('CLASS_FEATURE')) return 'Class Feature';
  if (s.includes('HYBRID_CLASS')) return 'Hybrid Class';
  if (s.includes('GRANTS')) return 'Grants';
  if (s.includes('BACKGROUND')) return 'Background Choice';
  if (s.includes('TRAIT_PACKAGE')) return 'Trait Package';
  if (s.includes('FAMILIAR')) return 'Familiar';
  return 'Internal';
}

export function exportarDnd4e(P) {
  const avisos = [];
  const C = calcular(P);
  const nivel = Math.max(1, +P.nivel || 1);
  const tally = [];       // { nivelEscolha, xml }
  const add = (n, xml) => tally.push({ n, xml });

  // níveis e patamares
  for (let l = 1; l <= nivel; l++) add(0, elemento(String(l), 'Level', `ID_INTERNAL_LEVEL_${l}`));
  add(0, elemento('Heroic', 'Tier', 'ID_INTERNAL_TIER_HEROIC'));
  if (nivel >= 11) add(0, elemento('Paragon', 'Tier', 'ID_INTERNAL_TIER_PARAGON'));
  if (nivel >= 21) add(0, elemento('Epic', 'Tier', 'ID_INTERNAL_TIER_EPIC'));

  // escolhas de construção
  for (const [campo, cat] of [['raca', 'race'], ['classe', 'class'], ['tema', 'theme'], ['antecedente', 'background'], ['divindade', 'deity'], ['paragon', 'paragonpath'], ['destino', 'epicdestiny']]) {
    const r = P[campo];
    if (!r?.nome) continue;
    const [tipo, pre] = CAT[cat];
    const id = idDe(tipo, r.nome) || (num(r.id) ? pre + num(r.id) : null);
    if (!id) { avisos.push(`${tipo} "${r.nome}" não tem id do Character Builder e ficou de fora.`); continue; }
    add(cat === 'paragonpath' ? 11 : cat === 'epicdestiny' ? 21 : 1, elemento(r.nome, tipo, id));
  }
  for (const f of P.talentos || []) {
    const id = idDe('Feat', f.nome) || (num(f.id) ? CAT.feat[1] + num(f.id) : null);
    if (!id) { avisos.push(`Talento "${f.nome}" sem id do CB (de fora).`); continue; }
    add(1, elemento(f.nome, 'Feat', id));
  }
  add(1, elemento('Melee Basic Attack', 'Power', 'ID_INTERNAL_POWER_MELEE_BASIC_ATTACK'));
  add(1, elemento('Ranged Basic Attack', 'Power', 'ID_INTERNAL_POWER_RANGED_BASIC_ATTACK'));
  for (const w of P.poderes || []) {
    const id = idDe('Power', w.nome) || (num(w.id) ? CAT.power[1] + num(w.id) : null);
    if (!id) { avisos.push(`Poder "${w.nome}" sem id do CB (de fora).`); continue; }
    add(Math.max(1, +w.nivel || 1), elemento(w.nome, 'Power', id));
  }
  for (const per of PERICIAS) {
    const id = idDe('Skill', per);
    if (id) add(0, elemento(per, 'Skill', id));
    if (P.pericias?.[per]?.treinada) add(1, elemento(per, 'Skill Training', `ID_INTERNAL_SKILL_TRAINING_${per.toUpperCase()}`));
  }
  // proficiências, características de classe/raça e outros "extras" preservados da importação original
  for (const e of P.extras || []) add(1, elemento(e.nome, tipoDeExtra(e.id), e.id));
  // visão em baixa luz/no escuro (raça): sem um RulesElement type="Vision" explícito, quem importa assume
  // visão normal sempre — detecta pelo texto da própria raça no compêndio (ex. "low-light vision").
  if (P.raca?.id) {
    const txtRaca = (comp.detalhe('race', P.raca.id)?.html || '').toLowerCase();
    if (/blindsight/.test(txtRaca)) add(1, elemento('Blindsight', 'Vision', 'ID_INTERNAL_VISION_BLINDSIGHT'));
    else if (/darkvision/.test(txtRaca)) add(1, elemento('Darkvision', 'Vision', 'ID_INTERNAL_VISION_DARKVISION'));
    else if (/low-light/.test(txtRaca)) add(1, elemento('Low-light', 'Vision', 'ID_INTERNAL_VISION_LOWLIGHT'));
  }
  if (P.genero) add(1, elemento(P.genero, 'Gender', 'ID_INTERNAL_GENDER'));
  if (P.tendencia) add(1, elemento(P.tendencia, 'Alignment', 'ID_INTERNAL_ALIGNMENT'));
  const tallyXml = tally.map((t) => '         ' + t.xml).join('\n');

  // árvore de níveis (o CB lê as escolhas daqui)
  const porNivel = new Map();
  for (const t of tally.filter((t) => t.n > 0)) { if (!porNivel.has(t.n)) porNivel.set(t.n, []); porNivel.get(t.n).push(t.xml); }
  const arvore = [];
  for (let l = 1; l <= nivel; l++) {
    const filhos = (porNivel.get(l) || []).map((s) => '         ' + s).join('\n');
    // nesta árvore (diferente da lista plana lá em cima) o CB de verdade NUNCA fecha a tag sozinha (/>),
    // mesmo quando o nível não ganhou nada — sempre abre e fecha, mesmo vazio. Testado abrindo no CB real:
    // usar /> aqui quebra a importação com "tag 'RulesElement' missing a body".
    arvore.push(`      <RulesElement name="${l}" type="Level" internal-id="ID_INTERNAL_LEVEL_${l}" legality="rules-legal" >${filhos ? `\n${filhos}\n      ` : ''}</RulesElement>`);
  }

  // estatísticas
  const stats = [];
  const a = P.atr || { base: P.atributos || {}, racial: {}, aumentos: {} };
  for (const [k, en, ali, modNome] of ATR) {
    const adds = [`            <statadd value="${a.base?.[k] ?? C.atributos[k]}" />`];
    if (a.racial?.[k]) adds.push(`            <statadd Level="1" value="${a.racial[k]}" />`);
    for (const [lv, lista] of Object.entries(a.aumentos || {})) { const n = lista.filter((q) => q === k).length; if (n) adds.push(`            <statadd Level="${lv}" value="${n}" />`); }
    stats.push(`         <Stat name="${en}" value="${C.atributos[k]}">\n            <alias name="${en}" />\n            <alias name="${ali}" />\n${adds.join('\n')}\n         </Stat>`);
    stats.push(`         <Stat name="${modNome}" value="${C.modificadores[k]}">\n            <alias name="${modNome}" />\n         </Stat>`);
  }
  const st = (nome, v, extra = []) => stats.push(`         <Stat name="${x(nome)}" value="${v}">\n            <alias name="${x(nome)}" />${extra.map((e) => `\n            <alias name="${x(e)}" />`).join('')}\n         </Stat>`);
  st('Level', nivel); st('Half-Level', Math.floor(nivel / 2));
  st('AC', C.ac); st('Fortitude Defense', C.fort); st('Reflex Defense', C.ref); st('Will Defense', C.vont);
  st('Hit Points', C.pv); st('Healing Surges', C.surtos); st('Healing Surge Value', C.valorSurto);
  st('Speed', C.velocidade); st('Initiative', C.iniciativa);
  for (const per of PERICIAS) { st(per, C.pericias[per] ?? 0); if (P.pericias?.[per]?.treinada) st(per + ' Trained', 5); }
  // o Tamanho não é um "value" numérico comum: o CB guarda o nome (Medium/Large...) no atributo "String"
  // do statadd logo depois do alias "Size" — sem isso, quem lê esse campo (ex. o importador do módulo do
  // Foundry) quebra, porque nunca checa se achou o Stat antes de navegar pros vizinhos dele.
  stats.push(`         <Stat name="Size" value="0">\n            <alias name="Size" />\n            <statadd String="${x(P.tamanho || 'Medium')}" Level="1" value="0" />\n         </Stat>`);

  // inventário
  const loot = [];
  const livres = [];
  for (const it of P.itens || []) {
    const qtd = Math.max(0, +it.qtd || 1), eq = it.equipado ? Math.min(qtd, 1) : 0;
    const els = [];
    if (it.base) {
      const tb = it.cat === 'implement' ? (['Superior Implement', 'Implement'].find((q) => idDe(q, it.base.nome)) || 'Implement') : { weapon: 'Weapon', armor: 'Armor' }[it.cat] || 'Weapon';
      const nb = it.base.nome;
      const ib = idDe(tb, nb);
      if (ib) els.push(elemento(nb, tb, ib)); else avisos.push(`${tb} "${nb}" sem id do CB.`);
      if (it.ench) {
        const nm = it.ench.mais ? `${it.ench.nome} +${it.ench.mais}` : it.ench.nome;
        const im = idDe('Magic Item', nm) || idDe('Magic Item', it.ench.nome);
        if (im) els.push(elemento(nm, 'Magic Item', im)); else avisos.push(`Item mágico "${nm}" sem id do CB.`);
      }
    } else if (it.cat === 'item') {
      const v = it.variante || {};
      const tentativas = [v.mais ? `${it.nome} +${v.mais}` : null, TIER[v.nivel] ? `${it.nome} (${TIER[v.nivel]} tier)` : null,
        v.nivel ? `${it.nome} (level ${v.nivel})` : null, it.nome].filter(Boolean);
      const nm = tentativas.find((n) => idDe('Magic Item', n));
      if (nm) els.push(elemento(nm, 'Magic Item', idDe('Magic Item', nm))); else avisos.push(`Item "${it.nome}" sem id do CB.`);
    } else {
      const tipo = ['Gear', 'Item', 'Ritual', 'Weapon', 'Armor', 'Implement', 'Magic Item'].find((t) => idDe(t, it.nome));
      if (tipo) els.push(elemento(it.nome, tipo, idDe(tipo, it.nome)));
      else { livres.push(`${it.nome}${qtd > 1 ? ' x' + qtd : ''}`); continue; }
    }
    const nomeLoot = it.nome && (it.base || it.cat === 'item') ? ` name="${x(limpa(it.nome))}"` : '';
    let augAttr = '';
    if (it.augment?.nome) { // augment: atributo na arma + o shard solto, como o CB grava
      const nmA = `${it.augment.nome} (${(it.augment.nivel >= 20 ? 'epic' : it.augment.nivel >= 10 ? 'paragon' : 'heroic')} tier)`;
      const ia = idDe('Magic Item', nmA);
      if (ia) {
        augAttr = ` augment="&lt;?xml version=&quot;1.0&quot; encoding=&quot;utf-16&quot;?&gt;&lt;CharLootID&gt;&lt;baseID&gt;${ia}&lt;/baseID&gt;&lt;/CharLootID&gt;"`;
        loot.push(`         <loot count="1" equip-count="0" >
            ${elemento(nmA, 'Magic Item', ia)}
         </loot>`);
      } else avisos.push(`Augment "${nmA}" sem id do CB.`);
    }
    if (els.length) loot.push(`         <loot count="${qtd}" equip-count="${eq}"${nomeLoot}${augAttr} >\n${els.map((e) => '            ' + e).join('\n')}\n         </loot>`);
  }

  // detalhes
  const din = String(P.dinheiro || '');
  const comigo = (/Consigo:\s*([^|]+)/i.exec(din) || [])[1] || (/^\s*\d+\s*(gp|po)?\s*$/i.test(din) ? din : '');
  const guardado = (/Guardado:\s*([^|]+)/i.exec(din) || [])[1] || '';
  const notaFicha = [(P.notas || []).find((n) => n.titulo === 'Notas da ficha')?.texto, livres.length ? 'Itens sem equivalente no CB: ' + livres.join(', ') : ''].filter(Boolean).join('\n\n');
  const diario = (P.notas || []).filter((n) => n.titulo !== 'Notas da ficha').map((n) =>
    `         <JournalEntry>\n            <Title> ${x(limpa(n.titulo))} </Title>\n            <TimeStamp> ${x(n.criado || '')} </TimeStamp>\n            <Notes> ${x(limpa(n.texto))} </Notes>\n         </JournalEntry>`).join('\n');
  const idiomas = String(P.idiomas || '').split(/,\s*/).filter(Boolean);
  const langXml = idiomas.map((l) => idDe('Language', l) ? '         ' + elemento(l, 'Language', idDe('Language', l)) : '').filter(Boolean).join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D20Character game-system="D&amp;D4E" Version="0.07a" legality="rules-legal">
   <!--
      Dungeons and Dragons Insider: Character Builder character save file
      (exportado pelo Grimório do Aventureiro)
   -->
   <CharacterSheet>

      <Details>
         <name> ${x(limpa(P.nome))} </name>
         <Level> ${nivel} </Level>
         <Player> ${x(limpa(P.jogador))} </Player>
         <Height> ${x(limpa(P.altura))} </Height>
         <Weight> ${x(limpa(P.peso))} </Weight>
         <Gender> ${x(limpa(P.genero))} </Gender>
         <Age> ${x(limpa(P.idade))} </Age>
         <Alignment> ${x(limpa(P.tendencia))} </Alignment>
         <Company>  </Company>
         <Portrait>  </Portrait>
         <Experience> ${+P.xp || 0} </Experience>
         <CarriedMoney> ${x(limpa(comigo))} </CarriedMoney>
         <StoredMoney> ${x(limpa(guardado))} </StoredMoney>
         <Traits> ${x(limpa(P.tracos))} </Traits>
         <Appearance> ${x(limpa(P.aparencia))} </Appearance>
         <Companions> ${x(limpa(P.companheiros))} </Companions>
         <Notes> ${x(limpa(notaFicha))} </Notes>
      </Details>

      <StatBlock>
${stats.join('\n\n')}
      </StatBlock>

      <!--
         The tally of the character's rules elements
      -->
      <RulesElementTally>
${tallyXml}${langXml ? '\n' + langXml : ''}
      </RulesElementTally>

      <!--
         The tally of the character's loot
      -->
      <LootTally>
${loot.join('\n')}
      </LootTally>

      <Journal>
${diario}
      </Journal>

   </CharacterSheet>

   <D20CampaignSetting name="">
      <!--
         Dungeons and Dragons Insider: Character Builder campaign save file
      -->
   </D20CampaignSetting>

   <!--
      Level tags are an internal tree of rules elements, see RulesElementTally above.
   -->
   <Level>
${arvore.join('\n')}
   </Level>

</D20Character>
`;
  return { xml, avisos };
}
