---
name: interface-design
description: Desenho de interface com acabamento para o Grimório do Aventureiro (ficha de D&D 4e, grimório de poderes, compêndio, editor de criaturas, configurações). Use ao criar, refinar ou revisar telas e componentes, quando hierarquia, tokens, estados ou consistência com o DESIGN.md importam. Não serve para material de divulgação.
---

# Interface Design (Grimório)

> Adaptada da skill `interface-design` usada no projeto frota. O que era SaaS, React e Tailwind foi trocado pelo stack e pela direção deste projeto. A direção visual não se decide aqui: ela está no `DESIGN.md`. Esta skill cuida da execução.

## O que governa o quê

1. **`DESIGN.md`**: direção (Material Design 3, tema escuro inspirado no foundryvtt.com, âmbar como único acento, Cinzel nos títulos, Signika no corpo, escala de forma, elevação por tom de superfície, dials ENERGY 2 / RHYTHM 2 / MOTION 2). Em conflito com esta skill, vale o `DESIGN.md`.
2. **antislop** (bloco no fim do `CLAUDE.md`): filtro. Roda junto, inclusive o Delivery Gate.
3. **Esta skill**: como transformar a direção em tela sem cair no genérico.

Só explore uma direção nova (domínio, paleta, assinatura) se o usuário pedir para mudar o `DESIGN.md`. Nesse caso, proponha e espere confirmação antes de tocar no `style.css`.

## Quem usa e o que precisa

- **Jogador** montando ou consultando a ficha, muitas vezes no meio da sessão de jogo: precisa achar o número certo (CA, defesas, PV, ataque de um poder) em segundos e confiar nele. Passar o mouse sobre um número mostra de onde veio cada bônus: isso é parte do produto, não enfeite.
- **Mestre** montando criaturas e consultando o compêndio: densidade alta, comparação rápida, bloco de estatísticas imprimível.
- O app é desktop primeiro (Electron, janela mínima 900×600, normalmente maximizada). A versão web legada roda no navegador e pode cair em telas menores.

Antes de mexer numa tela, diga em uma linha qual é a tarefa dela e qual elemento precisa vencer (o foco da tela).

## O stack, e o que usar dele

- **Sem bundler, sem framework.** As telas são templates de string em `app.js` e `criatura.js`, re-renderizados por inteiro (`desenharHome`, `desenharFicha`, abas, grimório). Siga esse padrão; não introduza componentes, JSX nem biblioteca de estado.
- **Bootstrap 5.3** (servido de `/vendor`, offline): grid e utilitários de layout (`row`, `col-*`, `d-flex`, `gap-*`) e os componentes com comportamento pronto: **modal, dropdown, tooltip, collapse** via `bootstrap.bundle`. Eles já trazem teclado, foco e ARIA; use-os em vez de escrever o comportamento à mão. O modal se abre com o helper `modal(id)`.
- **Peças próprias do `style.css`**, reutilize antes de criar outra: `.folha` (superfície de seção), `.btn-rpg` (ação principal, âmbar), `.btn-rpg-sec`, `.btn-rpg-mini`, `.btn-discreto`, `.rotulo` (rótulo pequeno em caixa alta), `.tag`, `.lista-item`, `.aba`/`.abas`, `.carta`/`.carta-pod` (cartas do grimório), `.toast-rpg` (via `toast()`), `.jan-nota` (anotações flutuantes), `.sb-*` (bloco de estatísticas de criatura).
- **Helpers do `app.js`**: `$`, `$$`, `api`, `esc` (escape obrigatório em todo texto interpolado), `toast`, `modal`, `escolher` (seletor do compêndio), `agendarSalvar`.
- **Fontes e libs só de `/vendor`.** Nada de CDN no app: ele precisa funcionar sem internet. Pacote novo de front entra em `VENDOR` no `server.js`.

## Tokens

Toda cor, raio e sombra sai de uma variável do `style.css`:

- Superfícies por elevação: `--md-surface-dim` (fundo) → `--md-surface` → `--md-surface-container-lowest/low/(base)/high/highest`. A hierarquia vem do tom, não de sombra pesada nem de borda forte.
- Texto em níveis: `--md-on-surface` (principal, tom pergaminho), `--md-on-surface-variant` (apoio), `--md-outline` (metadado, bordas). Sobre cor de destaque, use o par `on-*` correspondente.
- Acento: `--md-primary` para ação e foco, e só para isso. `--md-*-container` + `--md-on-*-container` para destaques suaves.
- Regra de jogo, não decoração: `--md-atwill-*` (à vontade), `--md-encounter-*` (encontro), `--md-daily-*` (diário), `--md-item-*`. Não reaproveite essas cores para outra coisa.
- Estado: `--md-error-*`, `--md-warning-container`, `--md-success-container`.
- Forma: `--shape-xs` 4px (botão pequeno, chip) · `--shape-sm` 8px · `--shape-md` 12px (card) · `--shape-lg` 16px (modal, folha) · `--shape-xl` 28px · `--shape-full` (só selos de status).
- Sombra: `--elev-1..3`, só em elementos que flutuam de verdade (modal, anotação arrastável, dropdown).
- Tipografia: `--fonte-titulo` (Cinzel) em títulos e números de destaque da ficha; `--fonte-corpo` (Signika) no resto.

Nada de hex solto, nem em `style="..."` dentro de template. Se nenhum token serve, isso é decisão de design: proponha o token novo no `style.css` (e registre no `DESIGN.md` com aprovação), não um valor avulso. Os tokens do tema antigo (`--ouro*`, pergaminho, couro) não existem mais.

## Hierarquia e composição

- **Um foco por tela.** Na ficha, os números calculados (defesas, PV, ataques) lideram. No grimório, a carta do poder. No compêndio, o texto da entrada. Dê ao foco tamanho, contraste ou espaço; rebaixe o resto de propósito.
- **Peso e cor fazem mais que tamanho.** Três níveis no mesmo tamanho: valor (600, `on-surface`), rótulo (`.rotulo`, `on-surface-variant`), meta (400, `outline`). Números que mudam usam `font-variant-numeric: tabular-nums`.
- **Densidade é decisão.** A ficha e o bloco de criatura são densos (ferramenta de mesa); o leitor do compêndio respira mais (leitura longa). Escolha o espaçamento e repita, em múltiplos de 4px ou nos utilitários de espaçamento do Bootstrap.
- **Ritmo desigual de propósito:** agrupe o que é relacionado (atributo e modificador), e separe grupos com espaço, não com mais bordas.
- **Bilíngue:** nomes do compêndio aparecem como `Original (Tradução)` (`.pt-nome` para a parte traduzida) e o botão 🌐 alterna o texto. Teste o layout com o texto mais comprido dos dois idiomas.

## Controles: nativo → Bootstrap → à mão

1. **HTML nativo primeiro.** Clicável é `<button>` ou `<a>`, nunca `<div>`/`<span>` com handler. Hoje há casos herdados (resultados da busca global, `cartao-pers`, `[data-ver]`); ao mexer neles, troque por elemento nativo ou complete o contrato de teclado.
2. **Componente do Bootstrap** para modal, dropdown, tooltip, abas com conteúdo oculto.
3. **À mão só em último caso**, e então com o contrato completo: teclado (setas, Enter, Escape), foco que entra e volta, ARIA de papel e estado, clique fora.

Ação destrutiva ou irreversível pede confirmação. O padrão atual é `confirm()` nativo (no Electron ele vira diálogo do sistema). Mantenha o padrão, a menos que a tarefa seja justamente trocá-lo.

## Estados

Todo interativo tem padrão, hover, foco visível (`:focus-visible` já usa `--md-primary`), ativo e desabilitado. A state layer do M3 é um overlay de 8% no hover e 10% no foco ou pressionado, com `color-mix` sobre a cor do próprio componente, não `filter: brightness`. Dados têm carregando (`.carregando`, `.spin`), vazio (com uma ação clara, como "Crie um novo ou importe uma ficha") e erro (`toast(msg, true)` mais o motivo perto de onde a ação aconteceu).

## Movimento (MOTION 2)

- Feedback de state layer e transições curtas: 100–160 ms em botão, até 250 ms em dropdown e modal (o fade do Bootstrap já resolve o modal).
- Só `transform` e `opacity`. Nomeie as propriedades; nunca `transition: all`.
- Nada de scroll-reveal, parallax ou animação em ação repetida (digitar, salvar, alternar abas).
- Respeite `prefers-reduced-motion`. Detalhes em `fixing-motion-performance`.

## Antes de escrever cada componente

Diga, curto:

```
Tarefa:     [quem usa e o que precisa fazer aqui]
Foco:       [o elemento que vence, e como: tamanho / peso / contraste / espaço]
Reuso:      [classes do style.css, componente do Bootstrap e helpers usados]
Tokens:     [superfície, texto, acento e forma, todos --md-* / --shape-*]
Estados:    [quais estados existem e como cada um aparece]
```

Se não souber justificar um item, você está no padrão genérico: pare e pense.

## Evite

- Borda como primeira coisa que se vê; saltos fortes entre superfícies.
- Hierarquia plana (tudo no mesmo peso e tamanho) ou monótona (mesmo card, mesmo gap em tudo).
- Mais de um acento por tela; cor de selo de poder fora do selo.
- Pílula (`--shape-full`) em botão comum; raio grande em elemento pequeno.
- Glow em mais de um lugar (só o d20 ou a ação em destaque pode ter, pontual).
- Estilo inline repetido em vários templates: é uma classe faltando no `style.css`.
- Reescrever o comportamento de modal, dropdown ou tooltip que o Bootstrap já faz.

## Verificar

1. `node teste-poder-stats.mjs` (e `teste-calculo.mjs` com fichas de exemplo) se a mudança tocar em número calculado.
2. Visual e fluxo: `npm run web` e Reticle em <http://localhost:3102> (ver `CLAUDE.md`), com um `until` que prove o resultado. O que só existe no app desktop (janela, menu, `%APPDATA%`) se verifica com o MCP `electron` após `npm run desktop:debug`.
3. Olhe em 900 px de largura e maximizado, em PT e EN, com ficha vazia e com ficha cheia (nível alto, muitos poderes e itens).
4. Delivery Gate do antislop.

## Depois

Se a tarefa firmou um padrão reutilizável (componente usado 2 ou mais vezes, medida que vale lembrar), ofereça registrá-lo no `DESIGN.md`. Escreva só com aprovação; o `DESIGN.md` é do usuário.
