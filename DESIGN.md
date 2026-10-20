# DESIGN.md — Grimório do Aventureiro

Direção substituída a pedido do usuário em 20/10/2026: sai o tema "pergaminho/couro" (versão anterior deste arquivo, histórico no git), entra **Material Design 3** (m3.material.io) com inspiração visual no site oficial **foundryvtt.com** (checado ao vivo no navegador nesta sessão: cores e fontes reais abaixo, não chutadas).

## Identidade

App de ficha de D&D 4e com estrutura de produto moderno (M3: tokens de cor, elevação por superfície, componentes com estado) mas alma de mesa de RPG sombria, não de SaaS corporativo. Referência direta: a home da Foundry VTT é escura, quase preta, com texto em tom pergaminho e um único acento âmbar/laranja (o d20 em brasa) — isso é o mood, não o tema antigo deste projeto.

## Personalidade

Sóbrio, com um único ponto de calor (âmbar) reservado para ação/destaque. Estrutura previsível e com estados claros (M3), não ornamentada à mão como antes — a moldura de cantos entalhados do tema anterior **sai**.

## Paleta M3 (seed colors reais, extraídos de foundryvtt.com nesta sessão)

M3 gera uma paleta tonal completa (0–100) a partir de poucas cores-semente; aqui documento as sementes e os papéis, não listo os 13 tons de cada uma.

- **Seed `primary`** = âmbar/laranja do d20 em destaque (~`#E8822C` a `#C9501F` no glow, aferido por captura de tela — faixa aproximada, não pixel exato). Papéis: `primary` (botões preenchidos, foco, ações), `on-primary` (texto sobre ele, quase preto), `primary-container`/`on-primary-container` (superfícies de destaque suave, ex. selo "à vontade" ativo).
- **Seed `neutral`** = `#0B0A13` (fundo real do body da Foundry, `rgb(11,10,19)`, quase preto com leve matiz azul). Gera `surface`, `surface-dim`, `surface-bright`, `surface-container-lowest/low/container/high/highest` (escala de elevação M3 por tom, não por sombra).
- **`on-surface`** = `#E7D1B1` (cor de texto real do body da Foundry, `rgb(231,209,177)`, pergaminho claro) — desvio proposital do neutro dessaturado padrão do M3, mantém a alma de RPG; registrado aqui como decisão de marca, não acidente.
- **Seed `secondary`** = `#9F8475` (borda real dos botões da Foundry, `rgb(159,132,117)`, marrom-acinzentado) — usar em `outline`, bordas de card não preenchido, divisores.
- **Seed `tertiary`** (opcional, 3º acento) = vermelho-sangue `#8E1B1B`, herdado do tema anterior só para o selo de poder "encontro" (regra de D&D 4e, informação, não decoração — ver Motivos).
- **`error`** = vermelho M3 padrão (`#B3261E` claro / `#F2B8B5` escuro), não reaproveitar o `tertiary` acima para erro de formulário.
- Cap do antislop (R-29): núcleo = primary (âmbar) + secondary (marrom-tan) + tertiary (vermelho, só no selo de poder) + 1 error; neutros (a escala `surface`/`on-surface` acima) não contam no limite.

## Temas claro e escuro (decisão de 20/10/2026)

Os dois temas usam as mesmas sementes acima; o escuro é o descrito nesta página, o claro usa os tons claros do M3 (primary âmbar escuro `#8a4d0f`, superfícies em pergaminho claro `#e3d9cd`→`#fffdfa`, texto em tinta marrom `#2b1e14`). Todos os pares de texto passam AA (4,5:1).

- **Estado inicial**: o tema do sistema (`prefers-color-scheme`). **Botão no topo** (☀ Claro / ☾ Escuro) troca e grava a escolha, que passa a valer sobre o sistema. Lógica em `tema.js`, carregado no `<head>` antes de pintar.
- **Tokens**: `style.css` define `:root` (escuro) e `:root[data-tema="claro"]`. Cor nova entra nos dois blocos; nada de cor fixa fora deles.
- **Selos de poder no claro**: verde e vermelho viram containers claros; o "diário" continua escuro, porque preto é a cor da regra.
- **Scrim de modal**: preto translúcido nos dois temas (M3), não a superfície.
- **Manual** (`manual/manual.html`): usa os mesmos tokens e segue o tema do app quando aberto pelo botão 📖 Manual; o PDF do pacote sai no claro (`?tema=claro`), que é o que funciona impresso.

## Tipografia (escala M3: Display/Headline/Title/Body/Label, cada um L/M/S)

- **Display e Headline**: `Cinzel` (serifada condensada-romana) — mantém o papel que a Foundry dá à sua serifada de marca (`Modesto Condensed`, fonte licenciada da Wizards, não reaproveitável aqui); Cinzel é aberta (Google Fonts) e cumpre o mesmo mood.
- **Title, Body, Label**: `Signika` — **a mesma fonte que a Foundry usa de verdade** no corpo (`font-family: Signika, "Palatino Linotype", sans-serif`, confirmado via DOM), sans-serif arredondada, de leitura longa. Troca `Crimson Pro` do tema anterior.
- Tamanhos seguem a escala M3 (Display L 57/M 45/S 36, Headline L 32/M 28/S 24, Title L 22/M 16/S 14, Body L 16/M 14/S 12, Label L 14/M 12/S 11), aplicados em `rem`.

## Forma (shape scale M3, substitui os cantos assimétricos do tema anterior)

`none 0` · `extra-small 4px` (chips, botão pequeno — bate com o `border-radius: 4px` real dos botões da Foundry) · `small 8px` · `medium 12px` (cards) · `large 16px` (modais, folhas) · `extra-large 28px` (hero/CTA grande) · `full` (badge/pill, só para selos de status, não para botão comum).

## Elevação (superfícies M3, substitui a moldura de pergaminho/tinta)

Hierarquia por **tom da superfície** (`surface-container-lowest → highest`, cada um um pouco mais claro que o `surface` base), não por sombra pesada nem textura de papel. Sombra (M3 elevation 0–5) só como reforço leve em elementos flutuantes de verdade (modal, janela de anotação arrastável, dropdown).

## Motivos de identidade (o que muda, o que fica)

- **Sai**: moldura de 4 cantos ornamentais em SVG, textura de pergaminho/radial gradients imitando papel, botões com `border-radius` de 4 valores distintos.
- **Fica, redesenhado em token M3**: o selo de poder por tipo (verde/vermelho/preto para à vontade/encontro/diário) — é regra de jogo, vira `tertiary-container` tonal em vez de cor chapada; o d20 como ícone de marca (inspirado no d20 em brasa da Foundry, não copiado pixel a pixel) no lugar do emoji genérico atual.
- **Entra**: state layer M3 em todo elemento interativo — overlay de 8% (hover), 10% (focus/pressed), 16% (dragged) sobre a cor do próprio componente, não um `filter: brightness` solto.

## Mood / dials (antislop)

- **ENERGY 2** (Balanced): fundo quase preto e calmo feito a home da Foundry fora do hero; o âmbar pontua ação, não cobre a tela.
- **RHYTHM 2**: toda tela usa o mesmo sistema de `surface-container` + shape scale; variação vem do conteúdo (ficha vs. grimório vs. bloco de criatura).
- **MOTION 2** (sobe de 1 para 2 frente ao tema anterior): M3 pede feedback de state layer e ripple em toque/clique, além de hover sutil — ainda sem scroll-reveal nem parallax.

## O que NÃO fazer aqui (colisão com antislop, decisão registrada)

- Gradiente azul-roxo genérico: o acento é âmbar, não azul/roxo — não confundir com o "Generic Blue-Purple Gradient" do antislop.
- Glow em tudo (R-13): o d20/ação em destaque pode ter glow âmbar pontual; nunca em card, badge, ícone e borda ao mesmo tempo.
- Pílula em tudo (R-11): shape scale M3 varia por componente (4/8/12/16/28/full); só selo de status usa `full`.
- Não copiar a Foundry pixel a pixel (R-30): usar os tokens extraídos como semente de paleta e o mood escuro+âmbar, não clonar o layout do site inteiro.
