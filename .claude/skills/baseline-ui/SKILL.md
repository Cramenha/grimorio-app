---
name: baseline-ui
description: Passada rápida de limpeza em telas do Grimório - espaçamento, hierarquia, tipografia, tokens e pequenos problemas de layout - com as regras do stack daqui (Bootstrap 5, style.css com tokens --md-*, templates de string). Use quando uma tela precisa de polimento rápido ou para revisar um arquivo contra o básico.
---

# Baseline UI (Grimório)

> Adaptada de `baseline-ui` (github.com/ibelick/ui-skills). A original exige Tailwind, `motion/react` e `cn`; aqui as mesmas intenções viram regras do stack e do `DESIGN.md` deste projeto. Para trabalho maior, use `interface-design`; o antislop vale sempre.

## Como usar

- `/baseline-ui`: aplicar estas regras em todo trabalho de UI da conversa.
- `/baseline-ui <arquivo>`: revisar o arquivo e reportar, para cada violação:
  - o trecho exato (citado);
  - por que importa (uma frase);
  - a correção concreta.

## Stack

- DEVE usar os tokens do `:root` do `style.css` (`--md-*`, `--shape-*`, `--elev-*`, `--fonte-*`) para cor, raio, sombra e fonte. Nunca hex solto, nem em `style="..."` de template.
- DEVE usar a grade e os utilitários de layout do Bootstrap 5 (`row`, `col-*`, `d-flex`, `gap-*`, `m*`/`p*`) antes de CSS novo.
- DEVE reutilizar as classes do `style.css` (`.folha`, `.btn-rpg`, `.btn-rpg-sec`, `.btn-rpg-mini`, `.rotulo`, `.tag`, `.lista-item`) antes de criar outra.
- NUNCA adicionar Tailwind, framework de componentes, biblioteca de animação ou recurso por CDN. O app é offline: pacote de front novo entra em `/vendor` (`VENDOR` no `server.js`).
- DEVE passar todo texto interpolado em template por `esc()`.
- DEVE mover para uma classe no `style.css` o estilo inline que aparecer em mais de um template.

## Componentes

- DEVE usar o componente do Bootstrap para tudo que tem teclado ou foco: modal (`modal(id)`), dropdown, tooltip, collapse.
- NUNCA reescrever à mão o comportamento de teclado ou foco que o Bootstrap já dá.
- DEVE usar `<button type="button">` para ação e `<a>` para navegação; nunca `div`/`span` clicável.
- DEVE dar `aria-label` a botão só com ícone ou emoji (`↻`, `✕`, `🗑`).

## Interação

- DEVE confirmar ação destrutiva ou irreversível. O padrão do projeto é `confirm()` nativo.
- DEVE mostrar o erro perto de onde a ação aconteceu, além do `toast(msg, true)`.
- DEVE ter estado de carregamento (`.carregando`/`.spin`) em toda chamada a `api()` que demore.
- DEVE dar ao estado vazio uma ação clara.
- NUNCA bloquear colar em `input` ou `textarea`.

## Animação (MOTION 2 do `DESIGN.md`)

- Pode: state layer no hover e no foco, transições curtas de cor e sombra em controles, fade dos modais.
- NUNCA animar ação repetida (digitar, salvar, trocar de aba) nem usar scroll-reveal ou parallax.
- DEVE animar só `transform` e `opacity` em movimento; pintura apenas em elementos pequenos.
- NUNCA passar de 200 ms em feedback de interação; nunca `transition: all`.
- DEVE respeitar `prefers-reduced-motion`.

## Tipografia

- DEVE usar `--fonte-titulo` (Cinzel) só em títulos e números de destaque, e `--fonte-corpo` (Signika) no resto.
- DEVE usar `text-wrap: balance` em títulos e `text-wrap: pretty` em parágrafos longos (leitor do compêndio).
- DEVE usar `font-variant-numeric: tabular-nums` em números que mudam (defesas, PV, ouro, bônus).
- O espaçamento entre letras não tem escala definida: o `style.css` usa vários valores (títulos `.03em`, `.rotulo` `.12em`, entre outros). Copie o valor do elemento equivalente que já existe; NUNCA invente um valor novo sem motivo.
- DEVE testar o texto mais comprido entre PT e EN (`Original (Tradução)`) e cortar com `text-overflow: ellipsis` ou `line-clamp` onde a densidade exige.

## Layout

- DEVE usar a escala de z-index existente: a do Bootstrap (1020 a 1055; as anotações em `#janelas` ficam em 1020), 2000 para `#toasts` e `.menu-macro`, e valores baixos (3, 5) para empilhamento local. NUNCA valores arbitrários novos.
- DEVE manter a tela usável em 900 px de largura (mínimo da janela do Electron).
- DEVE usar espaçamento em múltiplos de 4px, ou a escala do Bootstrap.

## Design

- NUNCA usar gradiente decorativo; nunca azul ou roxo.
- Glow só no d20 ou na ação em destaque, pontual e estático (`DESIGN.md`).
- DEVE limitar o acento (`--md-primary`) a ação e foco: um por tela.
- NUNCA usar as cores dos selos de poder (`--md-atwill/encounter/daily-*`) fora dos selos.
- `--shape-full` (pílula) só em selo de status, não em botão comum.
- Sombra (`--elev-*`) só no que flutua; o resto se separa pelo tom da superfície.
