# DESIGN.md — Grimório do Aventureiro

Direção visual já estabelecida (não é proposta nova; transcrita do app existente: `style.css`, `manual/`, `APRESENTACAO.md`).

## Identidade

Ficha de D&D 4e como livro de RPG físico: couro, pergaminho, tinta e ouro. Não é painel de SaaS, não é terminal dev. A tela inteira deve parecer uma mesa de jogo com um grimório aberto.

## Personalidade

Sério, artesanal, antigo. Ornamentado nas bordas (cantos de moldura, linha dupla de ouro), sóbrio no corpo (texto sobre pergaminho, sem brilho nem gradiente chamativo no conteúdo). Nunca "app moderno disfarçado de fantasia": cor e textura vêm de couro/pergaminho/tinta reais, não de glow roxo-azul.

## Paleta (núcleo: 3 cores + 1 acento, já em `:root` de `style.css`)

- **Pergaminho** `--perg #f2e4c0` / `--perg2 #e7d3a2` / `--perg3 #d9bf85` — fundo de conteúdo (folhas, cartas, modais).
- **Couro** `--couro #1a110b` / `--couro2 #2b1c12` — fundo da página.
- **Tinta** `--tinta #2b1a0e` / `--tinta2 #5a3d22` — texto sobre pergaminho, bordas, molduras.
- **Ouro** (acento) `--ouro #b8861b` / `--ouro2 #e0b64a` — título da marca, bordas de destaque (linha dupla no topo, moldura do grimório), nunca no corpo de texto.
- **Sangue** `--sangue #8e1b1b` / `--sangue2 #b02a2a` — título de seção dentro da folha, links, selo "encontro" das cartas de poder. É o único vermelho; não introduzir outro tom.
- Neutros fora da contagem: `--negro #222`, branco do texto sobre couro (`#eadfc4`).
- Selo por tipo de poder (regra de jogo, não decorativa): à vontade = `--verde #2f6b34`, encontro/diário = tons de `--sangue`/preto, item = dourado. Não usar essas 3 cores fora desse selo.

## Tipografia

- Títulos: `Cinzel` (serifada romana, maiúsculas largas) — identidade do grimório, nunca trocar por sans-serif.
- Corpo: `Crimson Pro` — serifada de leitura longa (a ficha tem muito texto corrido).
- Nunca usar monoespaçada nem uppercase+tracking largo fora de títulos de seção (`.rotulo`, cabeçalhos de tabela).

## Motivos de identidade (repetir, não variar)

- **Moldura de tinta com 4 cantos ornamentais** (`--canto-tl/tr/bl/br`, SVG embutido): toda "folha" de conteúdo (ficha, modal, cartão) tem essa moldura. É o motivo central do app — sem ele, qualquer pergaminho vira fundo bege genérico.
- **Linha dupla de ouro** (`border-bottom: 3px double var(--ouro)`) separando barra superior e abas do conteúdo.
- **Selo de carta por tipo** (verde/vermelho/preto conforme à vontade/encontro/diário): vem da regra de D&D 4e, é informação, não enfeite.
- Cantos de botão assimétricos (`border-radius` com 4 valores distintos) em vez de pílula — textura "cortado à mão", não arredondado genérico.

## Mood / dials (antislop)

- **ENERGY 2** (Balanced): nem GOV.UK sóbrio, nem Awwwards espalhafatoso. Ouro e vermelho pontuam, mas o grosso da tela é pergaminho/tinta calmos.
- **RHYTHM 2**: todas as telas usam o mesmo sistema de folha+moldura+carta; variação vem do conteúdo (ficha vs. grimório vs. bloco de criatura), não de layout solto.
- **MOTION 1**: hover sutil (`translateY(-4px) rotate(-.4deg)` nos cartões, `filter: brightness` nos botões), transições de 0,08–0,2s. Sem scroll-reveal, sem parallax, sem fade-in de entrada. O único movimento contínuo é o spinner de carregamento.

## O que NÃO fazer aqui (colisão com antislop, decisão registrada)

- Gradiente azul/roxo, glassmorphism, glow em botão: fora de contexto, não aparecem hoje e não devem aparecer.
- Ícone genérico (sparkle/magic/robot): o app já usa emoji temático (📖🐉💎) ou nenhum ícone; manter.
- Pílula em tudo: botões e tags já usam cantos assimétricos/retângulo arredondado, não pílula total.
