---
name: fixing-motion-performance
description: Audita e corrige movimento e performance de animação no Grimório (transições CSS do style.css, fade dos modais do Bootstrap, re-render por template) - propriedades compostas, layout thrashing, blur e prefers-reduced-motion, dentro do dial MOTION 2 do DESIGN.md. Use ao adicionar ou mudar transições e animações, ou quando algo travar.
---

# fixing-motion-performance (Grimório)

> Adaptada de `fixing-motion-performance` (github.com/ibelick/ui-skills): mesmas regras, aplicadas ao stack daqui (CSS puro + Bootstrap, sem biblioteca de animação).

## Como usar

- `/fixing-motion-performance`: aplicar estas regras em todo trabalho de animação da conversa.
- `/fixing-motion-performance <arquivo>`: revisar e reportar, para cada violação:
  - o trecho exato (citado);
  - por que importa (uma frase);
  - a correção concreta.

Não adicione biblioteca de animação (Motion, GSAP etc.). O app é CSS puro, com o fade dos modais do Bootstrap, e deve continuar assim.

## Quanto movimento este app quer

O `DESIGN.md` fixa **MOTION 2**:

- **Pode:** state layer (overlay de 8% no hover, 10% no foco ou pressionado), transições curtas de cor e sombra em controles pequenos, leve elevação no hover de cartões, fade dos modais, spinner de carregamento.
- **Não pode:** scroll-reveal, parallax, entrada em cascata de listas, animação em ação repetida (digitar na ficha, salvar, trocar de aba, alternar PT/EN).
- **Durações:** 100–160 ms em botões, até 250 ms em dropdown e modal.

## O que já existe no `style.css`

| Regra | Animação | Situação |
|---|---|---|
| `.btn-rpg, .btn-rpg-sec, .btn-rpg-mini` | `background-color .15s, box-shadow .15s` | ok: pintura em elemento pequeno |
| `.cartao-pers` | `box-shadow .15s, transform .15s` | ok |
| `.barra-vida > i` (`#barra-pv`, largura definida em `app.js`) | `width .2s` | anima layout. Superfície pequena e mudança pontual (PV), então é tolerável. Se for mexer, troque por `transform: scaleX()` com `transform-origin: left` |
| `.jan-nota` (arrastar) | `left`/`top` a cada `pointermove` | layout por frame num elemento só: tolerável. Ver correção abaixo se travar |
| `.spin` | `@keyframes gira` (rotate) | ok: composto. Não está pausado fora da tela, mas só aparece durante o carregamento |
| `.modal-backdrop.show` | fade do Bootstrap | ok: não substitua |
| geral | sem `prefers-reduced-motion` | **pendente**: ver regra 2 |

## Glossário de renderização

- composição: `transform`, `opacity`
- pintura: cor, bordas, gradientes, máscaras, imagens, filtros, sombras
- layout: tamanho, posição, fluxo, grid, flex

## Prioridades

| prioridade | categoria | impacto |
|---|---|---|
| 1 | padrões proibidos | crítico |
| 2 | escolha do mecanismo e movimento reduzido | crítico |
| 3 | medição | alto |
| 4 | rolagem | alto |
| 5 | pintura | médio-alto |
| 6 | camadas | médio |
| 7 | blur e filtros | médio |
| 8 | limites da ferramenta | crítico |

## Regras

### 1. Padrões proibidos (crítico)

- Não intercale leitura e escrita de layout no mesmo frame (cuidado no arrastar das `.jan-nota` e no zoom do grimório).
- Não anime layout de forma contínua em superfícies grandes (grade de cartas, ficha inteira).
- Não dirija animação por evento de scroll, `scrollTop` ou `scrollY`.
- Nada de `requestAnimationFrame` em loop sem condição de parada.
- Nunca `transition: all`; nomeie as propriedades.

### 2. Mecanismo e movimento reduzido (crítico)

- Movimento usa `transform` e `opacity`.
- JS para animar só quando a interação exige (arrastar anotação). Para o resto, transição CSS.
- Pintura ou layout animados só em elementos pequenos e isolados (botão, barra de vida).
- Prefira rebaixar a técnica a remover o movimento.
- Inclua, uma vez, no `style.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
  .spin { animation-duration: 1.5s !important; animation-iteration-count: infinite !important; } /* o spinner informa carregamento: fica, mais lento */
}
```

### 3. Medição (alto)

- Meça uma vez e anime com `transform`.
- Agrupe todas as leituras do DOM antes das escritas.
- Re-render por template (`innerHTML` da tela inteira) não deve disparar animação de entrada em tudo de novo. Se um elemento precisa animar ao aparecer, anime só ele.
- Para efeitos que parecem de layout, use a técnica FLIP.

### 4. Rolagem (alto)

- Para visibilidade e pausa, use `IntersectionObserver`.
- Não leia a posição de rolagem para animar.
- Animações em loop param quando saem da tela.

### 5. Pintura (médio-alto)

- Animação que pinta só em elementos pequenos. Nunca anime `background` ou `box-shadow` da `.folha`, do modal ou da grade de cartas.
- Não anime variáveis CSS herdadas (`--md-*` no `:root`). Para variar a state layer, troque a propriedade no próprio elemento.
- `color-mix()` na state layer é calculado na troca de estado, não por frame. Pode usar.

### 6. Camadas (médio)

- Use `will-change` só durante a animação ativa (ex.: enquanto arrasta uma `.jan-nota`) e remova depois.
- Evite promover muitas camadas grandes (cada carta do grimório não precisa da sua).

### 7. Blur e filtros (médio)

- O `DESIGN.md` não usa blur nem glassmorphism. Não introduza `backdrop-filter` no fundo dos modais nem nas anotações.
- Se um dia houver: blur de até 8px, curto e único, nunca contínuo nem em superfície grande.
- O glow âmbar permitido (d20 ou ação em destaque) é estático. Não pulse.

### 8. Limites da ferramenta (crítico)

- Não adicione biblioteca de animação nem migre o fade do Bootstrap.
- Aplique as regras dentro do CSS e JS existentes.
- Não misture técnicas de animação no mesmo componente.

## Correções típicas daqui

```css
/* barra de vida: de layout para composição */
/* antes */ .barra-vida > i { transition: width .2s; }
/* depois */ .barra-vida > i { width: 100%; transform-origin: left; transition: transform .2s; }
```

```js
// e em app.js, onde hoje faz b.style.width = …%:
b.style.transform = `scaleX(${Math.max(0, Math.min(1, (+P.pvAtual || 0) / (C.pv || 1)))})`;
```

```js
// arrastar anotação (.jan-nota, app.js): hoje cada pointermove escreve left/top (layout).
// Num elemento só é tolerável; se travar, mova por transform e grave left/top uma vez ao soltar,
// porque o salvamento lê offsetLeft/offsetTop.
const mover = (ev) => { el.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px)`; };
const soltar = () => {
  const r = el.getBoundingClientRect();           // lê uma vez
  el.style.transform = ''; el.style.willChange = '';
  el.style.left = r.left + 'px'; el.style.top = r.top + 'px';   // escreve uma vez
  n.janela.x = el.offsetLeft; n.janela.y = el.offsetTop; agendarSalvar();
};
el.style.willChange = 'transform';
```

## Como revisar

- Primeiro os críticos: padrões proibidos, movimento reduzido e limites da ferramenta.
- Escolha o trabalho de renderização mais barato que cumpre a intenção.
- Para toda escolha fora do padrão, diga a restrição que a justifica (tamanho da superfície, duração ou exigência da interação).
- Com algo travando, meça no DevTools do Electron (menu Exibir > Ferramentas de desenvolvedor, aba Performance) antes de mudar.
