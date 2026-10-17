// Lê do texto (em inglês) de um talento os bônus de ataque/dano que valem só para certas armas e os efeitos condicionais.
// As regras do CB (regras.json) não trazem esses talentos de forma estruturada; o compêndio só tem a frase.
// Reconhece só o que é regular (como passivas.mjs faz com itens); o resto é ignorado em silêncio.
const texto = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// "an axe" -> ["axe"]; "light blades or heavy blades" -> ["light blade", "heavy blade"]
function grupos(frase) {
  return String(frase || '').split(/\s+or\s+|,\s*(?:or\s+)?|\s+and\s+/i)
    .map((g) => g.trim().toLowerCase().replace(/^(an?|the)\s+/, '').replace(/\s+weapons?$/, '').replace(/s$/, ''))
    .filter(Boolean);
}

// escala: [[nivelMinimo, valor], ...] em ordem crescente
export const valorNoNivel = (escala, nivel) => escala.reduce((v, [n, x]) => (nivel >= n ? x : v), 0);

function escalaDe(base, depois) {
  const escala = [[1, base]];
  for (const m of depois.matchAll(/increases? to \+(\d+) at (\d+)(?:st|nd|rd|th) level/gi)) escala.push([+m[2], +m[1]]);
  return escala;
}

// -> { bonus: [{ stat, escala, tipo, grupos, soArma }], condicionais: [{ stat, valor, condicao, grupos }] }
export function efeitosDoTexto(html, tipoPadrao = 'feat') {
  const t = texto(html);
  const bonus = [], condicionais = [];
  const re = /\+(\d+)\s+(feat|item|power|racial|proficiency|enhancement)?\s*bonus to (weapon )?(attack|damage) rolls(?: you make)?(?: with (?:an? |the )?([^.]+?))?(?=\.|,| This bonus| Also)([^]*?)(?=\+\d+\s+\w*\s*bonus to |$)/gi;
  for (const m of t.matchAll(re)) {
    bonus.push({ stat: m[4].toLowerCase() + ' rolls', escala: escalaDe(+m[1], m[6] || ''), tipo: (m[2] || tipoPadrao).toLowerCase(), grupos: grupos(m[5]), soArma: !!m[3] });
  }
  for (const m of t.matchAll(/(?:Whenever|When) you hit an? ([a-z]+) target with an? ([a-z ]+?)(?: or an? ([a-z ]+?))?\s*,\s*the target takes (\d+) extra damage/gi)) {
    condicionais.push({ stat: 'damage rolls', valor: +m[4], condicao: `against a ${m[1].toLowerCase()} target`, grupos: grupos([m[2], m[3]].filter(Boolean).join(' or ')) });
  }
  // "You gain proficiency [and a +2 feat bonus to damage rolls] with axes and hammers"
  const proficiencias = [];
  for (const m of t.matchAll(/gain proficiency(?: and [^.]*?)? with ([^.]+?)(?:\.|,| and (?:a|an|the)\s)/gi)) proficiencias.push(...grupos(m[1]));
  return { bonus, condicionais, proficiencias };
}
