// Compara o cálculo do app com os valores que o próprio Character Builder gravou nas fichas de exemplo.
import fs from 'node:fs';
import { lerDnd4e } from './importar.mjs';
import { calcular } from './calculo.mjs';
const arqs = process.argv.slice(2);
for (const f of arqs) {
  const p = lerDnd4e(fs.readFileSync(f, 'utf8'));
  const c = calcular(p);
  const cb = p.valoresCB;
  const linha = (n, a, b) => `${n}: app ${a} / CB ${b} ${a === b ? 'OK' : '<<<<<< DIFERE'}`;
  console.log('===', p.nome, 'nível', p.nivel, p.classe?.nome, p.raca?.nome);
  console.log([linha('CA', c.ac, cb.ca), linha('Fort', c.fort, cb.fort), linha('Ref', c.ref, cb.ref), linha('Vont', c.vont, cb.vont), linha('PV', c.pv, cb.pv),
    linha('Surtos', c.surtos, cb.surtos), linha('Inic', c.iniciativa, cb.iniciativa), linha('Vel', c.velocidade, cb.velocidade)].join('\n'));
  console.log('atributos app', JSON.stringify(c.atributos), 'CB', JSON.stringify(p.atributos));
  const per = Object.entries(c.pericias).map(([k, v]) => { const cbv = +(/<Stat name="${k}"/.test('') ? 0 : 0); return k + ' ' + v; });
  const x = fs.readFileSync(f, 'utf8');
  const difs = Object.entries(c.pericias).filter(([k, v]) => { const m = new RegExp(`<Stat name="${k}" value="(-?\\d+)"`).exec(x); return m && +m[1] !== v; }).map(([k, v]) => `${k} app ${v} CB ${new RegExp(`<Stat name="${k}" value="(-?\\d+)"`).exec(x)[1]}`);
  console.log('perícias que diferem:', difs.join(' | ') || 'nenhuma');
  console.log('avisos:', c.avisos);
}
