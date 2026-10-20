---
name: improve-ui
description: Audita uma tela do Grimório contra as próprias evidências de design (DESIGN.md e tokens do style.css), aponta problemas de UI comprovados e escreve planos de implementação autossuficientes para outro agente executar. Somente leitura no código do produto. Use para revisar, refinar ou limpar uma interface sem trocar a identidade dela, investigar desvios do design system ou preparar uma passagem de design.
---

# Improve UI (Grimório)

> Adaptada de `improve-ui` (github.com/ibelick/ui-skills) para este projeto: superfícies, fontes de design e validação apontam para o Grimório. O rigor de prova da original foi mantido.

Audite uma superfície coerente contra o sistema que de fato a governa. Preserve a identidade do produto, reutilize o que já existe e prefira nenhum achado a um achado sem prova. Escreva planos só para as mudanças que o usuário escolher; outro agente executa.

## Limites

- Nunca altere o código do produto. Crie ou edite arquivos só em `design-plans/`.
- Não instale dependências, não rode formatadores, não faça commit nem push.
- Não altere o `DESIGN.md`. Mudanças aceitas na documentação vão no plano, para quem executar.
- Use evidência renderizada só quando o usuário fornecer (captura de tela) ou pedir inspeção visual. Nesse caso, use o Reticle com `npm run web` (<http://localhost:3102>) ou o MCP `electron` com `npm run desktop:debug`.
- Cada plano precisa ser autossuficiente: quem executa não tem o contexto da auditoria nem da conversa.

## 1. Escolha a superfície

Respeite o escopo pedido. Se for amplo, escolha uma família de telas ligada a uma tarefa principal e diga qual escolheu. As superfícies deste app:

| Superfície | Onde nasce |
|---|---|
| Início (aventureiros, criaturas, seus dados) | `desenharHome`, `rodapeDados` em `app.js` |
| Ficha do personagem e abas | `desenharFicha` e funções `aba*` em `app.js` |
| Grimório de poderes (cartas) | `desenharGrimorio` em `app.js`, modal `#grimorio` |
| Compêndio: busca global, seletor e leitor | `#busca-global`, `escolher`, `abrirLeitor`; modais `#modalPicker` e `#modalLeitor` em `index.html` |
| Editor e bloco de criatura | `criatura.js` |
| Configurações | modal `#modalConfig` |
| Anotações flutuantes | `.jan-nota` em `app.js` |

Comece pela função que desenha a tela e siga o caminho renderizado: template → classes → regras do `style.css` → tokens. Não comece com uma busca no repositório inteiro por inconsistências.

Uma ligação só existe quando provada por renderização, chamada de função, classe aplicada, herança de CSS ou arquivo carregado pela tela. Nome parecido, token semelhante ou proximidade no repositório não provam nada. Exclua o que não participa do caminho: `manual/`, `extensao-roll20/`, `launcher/`, ferramentas de manutenção (`traduzir*`, `extrair-*`) e as saídas exportadas (PDF, Roll20, Foundry), salvo pedido explícito.

## 2. Reconstrua o sistema local

As fontes de design deste projeto:

- `DESIGN.md`: decisões documentadas (paleta M3, tipografia, forma, elevação, motivos, dials, o que não fazer).
- `:root` do `style.css`: tokens `--md-*`, `--shape-*`, `--elev-*`, `--fonte-*`.
- Classes compartilhadas do `style.css` (`.folha`, `.btn-rpg*`, `.rotulo`, `.tag`, `.lista-item`, `.carta*`, `.sb-*`) e os componentes do Bootstrap 5.3 que a tela usa.

Valores em `style="..."` dentro dos templates são implementação local, não decisão de design. Os tokens do tema antigo (`--ouro*`, pergaminho) estão fora do sistema atual por decisão registrada no `DESIGN.md`.

Registre:

```markdown
## Linguagem de design
- Superfície auditada:
- Fontes de design:
- Decisões documentadas:
- Donos e consumidores:
- Exceções explícitas:
```

Escreva `Nenhuma documentada` em `Exceções explícitas`, a menos que uma fonte citada aponte a exceção.

## 3. Prove os achados

Antes do filtro de prova, examine rótulos, estado ativo, ramos responsivos e variantes irmãs da superfície em busca de contradições internas. Isso gera só candidatos.

Um achado está no escopo quando a correção muda principalmente apresentação visual, texto da interface, layout, estilo de componente ou conformidade com uma regra do `DESIGN.md`. Se a correção muda principalmente se o comportamento funciona (cálculo, salvar, importar), rejeite.

Busca, repetição e diferença de implementação geram candidatos, não achados. Mantenha um candidato só quando as três provas existem:

1. **Contrato**: cite uma decisão do `DESIGN.md` ou um token que governa essa propriedade nesse escopo, ou uma contradição direta na apresentação ou no texto dentro da mesma tarefa. "Prefira", "em geral", omissão, repetição e ausência de exceção não estabelecem contrato.
2. **Execução**: prove que o dono, o valor ou o comportamento citado chega à superfície afetada pelo caminho renderizado.
3. **Correção**: diga uma mudança exigida pela evidência, nomeando exatamente o token, a classe ou o exemplo existente. Se a evidência não decide a escolha, se houver alternativas, ou se a correção exigir inventar intenção de produto, rejeite.

O código prova violações de token, tipografia, cor, espaçamento, layout, texto, variante e contrato do `DESIGN.md`. Hierarquia, destaque, densidade, clareza e usabilidade exigem evidência renderizada ou do usuário.

Descarte achados de acessibilidade e semântica HTML/ARIA, a menos que o usuário peça (para isso existe a skill `fixing-accessibility`). Descarte rotas, dados, falhas de ação, performance, arquitetura e qualidade de código, a menos que pedidos.

Atribua confiança só depois das três provas. Reutilize um dono existente quando a evidência sustenta; não crie classe ou token compartilhado só porque algo se repete.

## 4. Peneire

Antes de reportar, reabra cada fonte citada e tente derrubar cada candidato. Apague quando:

- o problema não bate exatamente com a implementação citada;
- a regra não governa essa propriedade e superfície;
- há contraevidência de que a diferença é válida ou deliberada (ex.: cor de selo de poder é regra de jogo);
- a evidência admite mais de uma correção;
- a correção inventa intenção de produto;
- outro achado descreve o mesmo problema de raiz.

## 5. Reporte

Ordene por confiança, impacto no usuário, alcance e custo da correção. Pare em três.

```markdown
## Linguagem de design
- Superfície auditada:
- Fontes de design:
- Decisões documentadas:
- Donos e consumidores:
- Exceções explícitas:

## Achados
| # | Problema | Evidência | Mudança proposta | Escopo | Confiança |
| --- | --- | --- | --- | --- | --- |

## Melhorar primeiro
<O achado de maior alavanca e por quê, ou nenhuma recomendação sustentada.>
```

A evidência precisa mostrar o contrato, a ligação em execução e a consequência na interface. A mudança proposta tem uma correção só. Apague linhas sem todas as colunas, inclusive Confiança.

Em `Melhorar primeiro`, escolha um achado sobrevivente com a evidência mais forte e maior alavanca. Nunca combine achados.

Se nada sobreviver, escreva `Nenhum achado sustentado.` em `## Achados` e `Nenhuma recomendação sustentada.` em `## Melhorar primeiro`.

Se houver achados, pare e pergunte quais viram planos. Se o usuário já escolheu um achado ou pediu plano para uma melhoria descrita, siga com esse escopo. Se pedirem para corrigir direto, ofereça o plano; nunca implemente.

## 6. Especifique as mudanças escolhidas

Leia [references/plan-template.md](references/plan-template.md). Escreva um plano por mudança escolhida, nunca um por sintoma.

Antes de escrever, reabra cada fonte citada, registre o commit atual (`git rev-parse --short HEAD`), identifique as classes, tokens e exemplos exatos para reutilizar e mapeie as superfícies afetadas. Reconcilie um plano existente em vez de duplicar.

Não invente valores quando o `style.css` tem token ou classe para isso. Proponha token ou classe nova só depois de provar por que o sistema atual não expressa a decisão e quem deve compartilhá-la.

Se pedirem reconciliação, confira os planos existentes contra o código e o `DESIGN.md` atuais, e atualize evidência, superfícies afetadas e status.
