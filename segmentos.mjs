// Trechos de texto do HTML do compêndio: extrai (para traduzir) e remonta o HTML traduzido.
// Um "trecho" é um nó de texto entre tags; a tradução é guardada uma vez por trecho em compendio\pt.json.

const TEM_LETRA = /[A-Za-z]{2,}/;

// O iws escreve o alcance como "<b>Close</b> burst 5": junta a palavra solta ao tipo da área para traduzir "Close burst" inteiro
// (senão "Close" vira "Rajada contígua" e "burst 5" vira "Explosão 5", duplicando a palavra).
export function normaliza(html) {
  return html.replace(/<b>\s*(Close|Area)\s*<\/b>(\s*:?\s*)(burst|blast|wall)\b/gi, '<b>$1 $3</b>$2');
}

// Divide o HTML em [{ texto, ini, fim }] só com nós de texto traduzíveis (não mexe em tags nem em "Published in …").
export function trechos(html) {
  html = normaliza(html);
  const out = [];
  const semPub = html.search(/<p class=publishedIn>/i);
  const limite = semPub >= 0 ? semPub : html.length;
  const re = />([^<>]+)</g;
  let m;
  const h = html.slice(0, limite);
  while ((m = re.exec(h))) {
    const bruto = m[1];
    const t = bruto.trim();
    if (!t || !TEM_LETRA.test(t)) continue;
    out.push(t);
  }
  // texto solto antes da 1ª tag ou depois da última
  const ini = /^([^<>]+)</.exec(h);
  if (ini && ini[1].trim() && TEM_LETRA.test(ini[1])) out.unshift(ini[1].trim());
  return out;
}

const PUB = /<p class=publishedIn>Published in ([\s\S]*?)<\/p>/i;

// Substitui cada nó de texto pelo seu equivalente em português (dic: { original: português }).
export function aplicar(html, dic) {
  html = normaliza(html);
  const traduzTexto = (bruto) => {
    const t = bruto.trim();
    if (!t) return bruto;
    let pt = dic[t];
    if (!pt) return bruto;
    // o tradutor às vezes perde os ":" iniciais ("Alvo" + ": Uma criatura") ou inventa "Efeito:"; restaura pelo original
    if (/^:/.test(t) && !/^:/.test(pt)) pt = ': ' + pt;
    if (/^:\s*Efeito:\s*/.test(pt) && !/^:\s*Effect/i.test(t)) pt = pt.replace(/^:\s*Efeito:\s*/, ': ');
    if (!/^:/.test(t) && /^:\s/.test(pt)) pt = pt.replace(/^:\s*/, '');
    pt = pt.replace(/\t/g, ' ');
    const lead = bruto.slice(0, bruto.indexOf(t.charAt(0)));
    const trail = bruto.slice(bruto.lastIndexOf(t.charAt(t.length - 1)) + 1);
    return lead + pt + trail;
  };
  let h = html.replace(/>([^<>]+)</g, (_, b) => '>' + traduzTexto(b) + '<');
  h = h.replace(/^([^<>]+)</, (_, b) => traduzTexto(b) + '<');
  // alcances com criatura: "<b>Corpo a corpo</b> espírito 1" -> "<b>Espírito corpo a corpo</b> 1" (a criatura vem na frente)
  if (/<b>\s*(Melee|Ranged|Close|Area)[^<]*<\/b>\s*(spirit|beast|animal|companion)/i.test(html)) {
    const CAB = 'Corpo a corpo|À distância|Explosão contígua|Rajada contígua|Explosão de área|Muralha de área|Explosão|Rajada|Contíguo|Em área|Área';
    h = h.replace(new RegExp(`<b>\\s*(${CAB})\\s*</b>\\s*([A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)?)\\s+(\\d+)`, 'g'), (_, cab, quem, n) =>
      `<b>${quem.charAt(0).toUpperCase() + quem.slice(1)} ${cab.charAt(0).toLowerCase() + cab.slice(1)}</b> ${n}`);
  }
  h = h.replace(PUB, (_, r) => `<p class=publishedIn>Publicado em ${r.replace(/page\(s\)/g, 'página(s)')}</p>`);
  return h;
}

// Quantos trechos do HTML já têm tradução (0..1)
export function cobertura(html, dic) {
  const t = trechos(html);
  if (!t.length) return 1;
  return t.filter((x) => dic[x]).length / t.length;
}
