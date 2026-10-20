---
name: fixing-accessibility
description: Audita e corrige acessibilidade no Grimório (templates de string do app.js/criatura.js, index.html e Bootstrap 5) - nomes acessíveis, teclado, foco, modais, contraste dos tokens --md-* e mensagens de erro. Use ao criar ou mudar controles, formulários, modais, abas, listas clicáveis, ou ao revisar acessibilidade.
---

# fixing-accessibility (Grimório)

> Adaptada de `fixing-accessibility` (github.com/ibelick/ui-skills): mesmas regras e prioridades, com os padrões e as pendências reais deste projeto.

## Como usar

- `/fixing-accessibility`: aplicar estas regras em todo trabalho de UI da conversa.
- `/fixing-accessibility <arquivo ou tela>`: revisar e reportar, para cada violação:
  - o trecho exato (citado);
  - por que importa (uma frase);
  - a correção concreta (no estilo do código daqui: template de string, `esc()`, classes do `style.css`).

Correções pequenas e localizadas. Não reescreva telas inteiras e não troque o Bootstrap por outra biblioteca.

## Onde o projeto está hoje

Ponto de partida conhecido, para não redescobrir a cada vez:

- **Não há nenhum atributo `aria-*`** em `index.html`, `app.js` ou `criatura.js`.
- **Botões só com ícone** dependem apenas de `title`, que não é nome acessível confiável: `↻` (`#btn-atualizar`), `🗑` (lixeira, excluir anotação), `✕` (limpar, remover, fechar anotação).
- **Elementos clicáveis que não são botão**: resultados da busca global (`#res-global div[data-id]`), cartões de personagem (`.cartao-pers[data-id]`), valores e nomes com `[data-ver]`. Hoje não recebem Tab nem respondem a Enter.
- **Modais são do Bootstrap** (`modal(id)`): prendem o foco, fecham com Escape e devolvem o foco ao gatilho. Não reimplemente isso; só confira se o gatilho é focável e se o modal tem título.
- **Confirmação destrutiva usa `confirm()` nativo** (no Electron vira diálogo do sistema, que já é acessível). Mantenha.
- **Avisos vão por `toast()`** (`.toast-rpg`, some sozinho em ~4,5 s).
- **Foco visível já existe**: `:focus-visible` com contorno `--md-primary`. Não remova sem substituto.

## Prioridades

| prioridade | categoria | impacto |
|---|---|---|
| 1 | nomes acessíveis | crítico |
| 2 | acesso por teclado | crítico |
| 3 | foco e modais | crítico |
| 4 | semântica | alto |
| 5 | formulários e erros | alto |
| 6 | anúncios | médio-alto |
| 7 | contraste e estados | médio |
| 8 | mídia e movimento | baixo-médio |
| 9 | limites da ferramenta | crítico |

## Regras

### 1. Nomes acessíveis (crítico)

- Todo controle interativo tem nome acessível.
- Botão só com ícone ou emoji ganha `aria-label` em português, e o emoji fica com `aria-hidden="true"` dentro de um `<span>`. Pode manter o `title` como dica visual.
- Todo `input`, `select` e `textarea` tem `<label>` associado (`for`/`id`) ou `aria-label`. O `.rotulo` visual só conta se for um `<label>` ligado ao campo.
- Links e botões com texto que diz o que fazem ("Mover para a lixeira", não "clique aqui").
- Emoji decorativo em texto de botão (`📥 Importar ficha`) é lido pelo leitor de tela; quando atrapalha, coloque-o num `<span aria-hidden="true">`.

### 2. Teclado (crítico)

- Clicável é `<button type="button">` ou `<a href>`. Ao mexer num `div`/`span` clicável, troque pelo elemento nativo e ajuste o CSS (`.lista-item`, `.cartao-pers`) para o botão não herdar o visual do Bootstrap.
- Se a troca não for possível, o elemento precisa de `tabindex="0"`, `role="button"` e resposta a Enter e Espaço.
- Nunca `tabindex` maior que 0.
- Escape fecha o que estiver aberto: modal (o Bootstrap já faz), resultados da busca global, menu de macro do Roll20 (`.menu-macro`), anotação em foco.
- Atalhos existentes (como Ctrl + roda para zoom no grimório) precisam de alternativa por botão. Os botões A−/A+ já cumprem isso.

### 3. Foco e modais (crítico)

- Use o modal do Bootstrap para qualquer sobreposição bloqueante; não crie overlay próprio.
- Modal novo tem `aria-labelledby` apontando para o título (`<h3>` do cabeçalho).
- Depois de re-renderizar uma tela inteira (`desenharFicha`, troca de aba), devolva o foco a um ponto lógico (a aba ativa ou o título), em vez de deixá-lo cair no `<body>`.
- As anotações flutuantes (`.jan-nota`) não são modais: não prendem o foco, mas precisam ser alcançáveis por Tab e fechar pelo teclado.

### 4. Semântica (alto)

- Elementos nativos antes de `role`. Se usar `role`, inclua os atributos que ele exige.
- Abas (`.abas`/`.aba`): `role="tablist"`, `role="tab"` com `aria-selected` e `aria-controls`, e painel com `role="tabpanel"`. Ou use as abas do Bootstrap, que já trazem isso.
- Listas são `ul`/`ol` com `li`. Tabelas de atributos e perícias (`.tabela-atr`, `.tabela-per`) usam `<th>` nos cabeçalhos.
- Não pule níveis de título: a ficha vai de `h2` (seção da `.folha`) para `h3`, não para `h5`.
- `<html lang="pt-BR">` já existe. Trechos em inglês do compêndio, quando a UI está em PT, podem levar `lang="en"`.

### 5. Formulários e erros (alto)

- Erro de campo ligado por `aria-describedby`, com `aria-invalid="true"` no campo.
- Campo obrigatório anunciado (`required` ou `aria-required`).
- Botão desabilitado explica o motivo perto dele, não só pela cor (`opacity: .38`).
- Falha de importação ou exportação: além do `toast`, deixe o motivo na tela quando o usuário precisar dele para corrigir algo (ex.: o painel de avisos `#painel-avisos` da ficha).

### 6. Anúncios (médio-alto)

- O contêiner `#toasts` precisa de `role="status"` e `aria-live="polite"` (os toasts de erro podem usar `role="alert"`). Toast não pode ser o único lugar de uma informação crítica.
- Carregamentos (`.carregando`, `.spin`) usam `aria-busy="true"` no contêiner ou texto de status. "Salvo ✓" (`#status-salvo`) é um bom candidato a `aria-live="polite"`.
- Controle que expande (busca global, menu de macro, seções recolhíveis) usa `aria-expanded` e `aria-controls`.

### 7. Contraste e estados (médio)

- Texto e ícones com contraste suficiente sobre a superfície em que aparecem. Pares de risco no tema escuro: `--md-outline` como texto sobre `--md-surface-container-*`, e texto dentro dos selos de poder (`--md-on-daily-container` sobre `--md-daily-container`).
- Para medir, use `.claude/skills/antislop-human/contrast-check.py` com os hex dos tokens no `:root` do `style.css`.
- Interação só por hover (tooltip de origem dos bônus) precisa de equivalente por foco: o mesmo conteúdo ao focar o número.
- Estado desabilitado ou selecionado não depende só de cor.
- Não remova o contorno de foco sem um substituto visível.

### 8. Mídia e movimento (baixo-médio)

- Retrato do personagem: `alt` com o nome do personagem; imagens decorativas com `alt=""`.
- Respeite `prefers-reduced-motion` em movimento não essencial (ver `fixing-motion-performance`).

### 9. Limites da ferramenta (crítico)

- Mudanças mínimas; não refatore código sem relação.
- Não adicione ARIA quando o HTML nativo já resolve.
- Não troque o Bootstrap nem crie componentes próprios para o que ele já oferece.
- Todo texto interpolado em template continua passando por `esc()`.

## Correções típicas daqui

```js
// botão só com ícone: nome acessível, emoji escondido
// antes
`<button class="btn-rpg-mini" data-del="${p.id}" title="Mover para a lixeira">🗑</button>`
// depois
`<button type="button" class="btn-rpg-mini" data-del="${p.id}" title="Mover para a lixeira" aria-label="Mover ${esc(p.nome)} para a lixeira"><span aria-hidden="true">🗑</span></button>`

// resultado da busca global: div clicável vira botão
// antes
`<div data-cat="${x.cat}" data-id="${x.id}">…</div>`
// depois (o CSS de #res-global > button zera o estilo padrão de botão)
`<button type="button" data-cat="${x.cat}" data-id="${x.id}">…</button>`
```

```html
<!-- contêiner de avisos anunciado ao leitor de tela -->
<div id="toasts" role="status" aria-live="polite"></div>
```

## Como revisar

- Primeiro os críticos: nomes, teclado, foco e limites da ferramenta.
- HTML nativo antes de ARIA.
- Cite o trecho, diga a falha, proponha a correção pequena.
- Para widgets complexos (menu, combobox, abas), prefira o componente do Bootstrap a comportamento próprio.
- Confirme no app rodando: com o Reticle (`npm run web`), navegue só por teclado (`press` Tab/Enter/Escape) e assegure o efeito com `reticle_act_and_wait`.
