# Grimório do Aventureiro

Fichas e anotações de **D&D 4ª edição**, no estilo do Character Builder, só que leve. É um app desktop que roda no seu computador; cada amigo instala o seu, com os próprios dados. **Sem IA, sem login e sem internet** (a internet só serve para verificar atualizações).

## Como usar
1. Execute o instalador `Grimorio-Setup-X.Y.Z.exe` e abra o atalho **Grimório do Aventureiro**. O compêndio do **iws.mx**, a tradução (`compendio\pt.json`) e as regras de cálculo (`compendio\regras.json`) já vêm no instalador.
2. Crie um personagem pela própria ficha (raça, classe, atributos, compra de equipamento…). Importar ficha pronta é opcional.

## Exportar e importar fichas
- **⬇ PDF editável**: gera a ficha em PDF com **campos de formulário** (abra no Edge, Chrome, Acrobat… preencha, salve). Os campos cinza são calculados (CA, defesas, PV, perícias…); os claros são seus: nome, atributos base e de raça, perícias treinadas, PV e surtos atuais, ouro, itens equipados, traços e todas as anotações.
- **Importar PDF**: lê os campos do PDF. O PDF exportado pelo app volta exatamente como estava, com as suas edições, e o app recalcula tudo. PDFs de outras fontes só funcionam se tiverem campos de formulário reconhecíveis (nome, atributos…).
- **PDF só de imagem** (digitalizado, sem campos): o app mostra a mensagem de que o PDF não é compatível e sugere as outras opções.
- **.dnd4e** (Character Builder) e **.json** (cópia exata da ficha) também importam.
- **⬇ .dnd4e (Character Builder)**: exporta a ficha no formato do CB (escolhas, talentos, poderes, itens, perícias, anotações e valores calculados). Itens sem equivalente no CB vão para as notas, com aviso.

## O que tem
- **Tradução pronta, sem login.** Todo o compêndio está em português (`compendio\pt.json`), com o nome sempre no original e a tradução entre parênteses: `Magic Missile (Mísseis Mágicos)`. O botão 🌐 do topo alterna o texto entre Português e English. Termos obrigatórios: Dazed = Pasmo, Stunned = Atordoado, Close blast = Rajada contígua, Close burst = Explosão contígua.
- **Busca em inglês e português**, em nomes e **dentro dos textos**, no campo do topo e em todos os seletores.
- **A ficha se calcula sozinha, como no Character Builder:** CA, Fortitude, Reflexos, Vontade, PV, surtos, velocidade, iniciativa, perícias e ataques das armas, com as regras do próprio CB (`compendio\regras.json`): fórmulas por nível, bônus de raça, classe, talentos, tema, caminho paragonal e de **armaduras, escudos, itens mágicos e armas equipados** (bônus do mesmo tipo não somam, penalidade de armadura e de velocidade, proficiência de armadura e escudo). Passe o mouse num número para ver de onde veio cada bônus.
- **Inventário:** compra armadura, escudo, arma, implemento e item mágico mostrando só o que cabe no nível do personagem; escolha da versão (+1, +2…) com nível e preço; desconta do ouro; ☑ equipado soma os bônus; "✨ Encantar" lista só encantamentos compatíveis.
- **Grimório de poderes:** janela grande com cartas coloridas (à vontade verde, encontro vermelho, diário preto, itens) e filtros.
- **Macro do Roll20:** poderes, **talentos e itens mágicos** (propriedades passivas e poderes de item) têm um botão discreto **R20** (no título da carta, nas listas de poderes e talentos e no inventário). Um clique copia a macro `&{template:dnd4epower}` pronta (ataque, dano, crítico, efeito, alcance…) para colar no chat ou numa macro do Roll20. Itens com propriedade e poderes abrem um menuzinho para escolher qual macro copiar. Funciona com os atributos da ficha padrão 4e do Roll20 (`@{wisdom-mod}`, `@{weapon-1-attack}`…). Poderes com ataque ou dano fora do padrão saem com o texto no campo e um aviso.
- **Ficha completa no Roll20 (plano Pro):** "📋 Copiar p/ Roll20" copia a ficha com os campos da ficha "D&D 4E" do Roll20 já calculados, os poderes nos espaços de poder e as macros. Instale `grimorio-importador.js` em Mod (API) Scripts, cole o texto nas notas de um handout e digite `!grimorio-importar NomeDoHandout`. Bônus passivos de itens em texto são interpretados: os incondicionais entram na conta, os situacionais ficam na macro "Passivas".
- **Criaturas (mestre):** ao lado de "Novo personagem" há **🐉 Nova criatura**: monte monstros, chefes e NPCs do zero ou a partir de qualquer um dos mais de 5 mil monstros do compêndio (também há um botão no próprio monstro). Escolha nível, função (soldado, bruto…) e grupo (padrão, elite, solo, lacaio) e o botão **🧮 Calcular** preenche CA, defesas, PV e iniciativa com a média dos monstros do compêndio; cada poder tem **✨ Sugerir ataque e dano**, e o botão **R20** copia a macro do Roll20 já com os números. Há bloco de estatísticas para imprimir e **📋 Copiar p/ Roll20** (mesma importação da ficha).
- **Anotações:** quantas janelas quiser, com nome editável, flutuantes, salvas sozinhas, com versões anteriores e linha do tempo (aba Histórico). Vão também para o PDF.

## Precisão do cálculo
Conferido contra as 9 fichas de exemplo do CB (`node teste-calculo.mjs <ficha.dnd4e>`): PV, surtos, iniciativa, velocidade e atributos batem; as defesas diferem no máximo 1 a 3 pontos quando a ficha tem escolhas internas do CB que o app não lê. Em fichas importadas essa diferença fica em **Ajustes manuais** (editável).

## Arquivos
`server.js` (rotas), `compendio.mjs` (busca nos dois idiomas), `calculo.mjs` (motor de regras), `pdf-ficha.mjs` (PDF editável: exportar e importar), `importar.mjs` (.dnd4e), `segmentos.mjs`, `index.html`/`app.js`/`style.css` (telas), `baixar-compendio.mjs` (copia o iws.mx). Ferramentas de quem mantém (precisam do Claude e do SDK em devDependencies): `traduzir-tudo.mjs`, `traduzir-nomes.mjs`, `verificar-traducao.mjs` (geram `pt.json`) e `extrair-regras.mjs` (gera `regras.json` a partir da pasta do CB). `electron/main.mjs` abre o app desktop com esse mesmo servidor. Dados do usuário em `%APPDATA%\Grimório do Aventureiro\dados` (personagens; excluídos vão para `lixeira\`); com `npm run web`, em `dados\` ao lado do código.

## Limites
- Escolhas internas do CB (benefícios de antecedente, algumas características de classe do núcleo) podem exigir ajuste manual de 1 a 3 pontos.
- Se o iws.mx ganhar entradas novas, elas aparecem em inglês até quem mantém rodar `node traduzir-tudo.mjs` e `node traduzir-nomes.mjs`.
- O compêndio vem do iws.mx (fonte não oficial de terceiros).
