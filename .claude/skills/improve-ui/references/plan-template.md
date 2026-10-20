# Modelo de plano de design

```markdown
# <Resultado>

Escrito contra: <commit, de `git rev-parse --short HEAD`, ou indisponível>

## Cadeia de evidências

- Superfície: `<função de app.js/criatura.js, modal do index.html ou estado renderizado>`
- Problema: <observação direta>
- Evidência de design: `<seção do DESIGN.md, token do style.css, classe ou tela renderizada>`
- Dono: `<arquivo e regra/função>`
- Escopo e superfícies afetadas: `<arquivos ou telas>`
- Incerteza: <nenhuma, ou o que precisa ser validado>

## Decisão de design

<A mudança, no escopo certo, e por que ela resolve o problema de raiz.>

## Reuso

- `<token --md-*/--shape-*, classe do style.css, componente do Bootstrap ou helper do app.js>`
- Exemplo: `<arquivo e função onde o padrão já está certo>`

Se for preciso um token ou classe nova, diga por que o sistema atual não expressa a decisão, onde ela entra no `style.css` e quem deve compartilhá-la.

## Mudanças

1. `<arquivo exato e função/regra>`
   - Mudança: <comportamento ou estrutura, pronta para implementar>
   - Preservar: <comportamento ou identidade válidos>
   - Verificar: <resultado observável>

## Escopo

- Herdam: <telas que recebem a mudança>
- Conferir: <telas que podem ser afetadas>
- Excluir: <exceções válidas e trabalho não relacionado>

## Validação

- Produto: <tarefa e resultado esperado>
- Interface: <telas, estados (ficha vazia/cheia), PT e EN, 900 px e maximizado, interações>
- Sistema: <reuso correto e nenhum padrão paralelo criado sem querer>
- Repositório:
  - `node teste-poder-stats.mjs` → `26 testes passaram.` (se tocar em número calculado)
  - Fluxo no Reticle com `npm run web` → `verified: "yes"` no estado final
  - Delivery Gate do antislop → aprovado

## Condições de parada

- Pare se <uma premissa central falhar, o dono mudar ou o escopo precisar crescer>.

## Documentação de design

- Depois de aceito e validado: <decisão exata a registrar no `DESIGN.md`, ou nenhuma>
```
