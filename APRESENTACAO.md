# Grimório do Aventureiro
### Fichas, compêndio e mesa de D&D 4ª edição — grátis, no seu computador, em português

Para quem nunca superou o Character Builder, e para quem sente falta dele: o **Grimório do Aventureiro** é um aplicativo local de D&D 4e que monta e calcula fichas, traz o compêndio inteiro **traduzido para o português**, cria criaturas para o mestre e entrega tudo pronto para o **Roll20**. Sem conta, sem assinatura, sem login e sem IA em tempo de uso: você dá dois cliques em um arquivo e abre no navegador.

---

## Em números

| | |
|---|---|
| **25.626** entradas no compêndio embutido | **139.920** trechos de texto traduzidos |
| **9.415** poderes | **3.272** talentos |
| **5.329** monstros | **776** armadilhas |
| **~3.600** itens mágicos, armas, armaduras e implementos | **77** classes · **55** raças · **577** trilhas exemplares |
| **116** temas · **817** antecedentes · **115** destinos épicos | **134** divindades · **360** rituais |
| **3.664** elementos de regra lidos para o cálculo automático | **9** fichas reais do Character Builder usadas para conferir o cálculo |
| **100 poderes** por ficha exportados ao Roll20 | **~19 MB** zipado, funciona sem internet |

Tudo vem do 4e Database do iws.mx (fonte não oficial de terceiros). O aplicativo é pessoal e gratuito, e cada jogador roda a própria cópia com os próprios dados.

---

## O que ele faz

### 1. Ficha que se calcula sozinha
- Escolha raça, classe, trilha exemplar, destino épico, tema, antecedente e divindade em seletores com busca.
- **CA, Fortitude, Reflexos, Vontade, PV, pulsos de cura, velocidade, iniciativa, perícias e ataques** são calculados com as regras do próprio Character Builder: fórmulas por nível, bônus de raça, classe, talentos, tema e itens, com **bônus do mesmo tipo que não se acumulam**, penalidades de armadura e proficiências.
- Passe o mouse em qualquer número e veja **de onde veio cada bônus**.
- Conferido contra 9 fichas reais do Character Builder: PV, pulsos, iniciativa, velocidade e atributos batem. As defesas diferem no máximo 1 a 3 pontos quando a ficha usa escolhas internas que o aplicativo não lê, e essa diferença fica visível como ajuste manual.
- Suporte a **classes híbridas** (mostra "Híbrido: Cleric + Invoker").

### 2. Inventário que compra, equipa e encanta
- Compre armadura, escudo, arma, implemento e item mágico vendo **só o que cabe no nível do personagem**, com a variante (+1, +2…), o nível e o preço; o valor sai do ouro.
- "✨ Encantar" lista só encantamentos **compatíveis** com a base escolhida (armaduras, armas e implementos).
- Equipou, os bônus entram na conta. O aplicativo avisa sobre falta de proficiência e item acima do nível.
- **Passivas de item em texto** ("+2 de bônus de item em Acrobacia") são lidas e somadas quando não têm condição; as situacionais ficam listadas.

### 3. Compêndio completo em português
- Todo o texto traduzido com contexto, mantendo o **nome original com a tradução entre parênteses**: `Magic Missile (Mísseis Mágicos)`.
- Glossário padronizado: Sangrando, Pulso de cura, Conduzir, Ajustar, Explosão de área, Rajada contígua, Explosão contígua, Trilha exemplar, Descanso longo, Sem limite…
- **Busca bilíngue**, em nomes e **dentro dos textos**. Botão 🌐 para alternar Português/English.
- Grimório de poderes em cartas coloridas (sem limite, encontro, diário, itens) com filtros.

### 4. Anotações de verdade
- Quantas janelas flutuantes quiser, com nome editável, arrastar, redimensionar e minimizar.
- Salvamento automático, **versões anteriores a cada 3 minutos** e linha do tempo.

### 5. 🐉 Criaturas para o mestre
- Crie monstros, chefes e NPCs do zero ou **a partir de qualquer um dos 5.329 monstros** do compêndio.
- Escolha nível, função (soldado, bruto, escaramuçador, artilheiro, controlador, espreitador) e grupo (padrão, elite, solo, lacaio). O botão **🧮 Calcular** preenche CA, defesas, PV, iniciativa e XP com valores **medidos nos próprios monstros do compêndio**.
- Cada poder tem **✨ Sugerir ataque e dano** e **🎚 Ajustar todos ao nível**.
- Bloco de estatísticas pronto para imprimir ou salvar em PDF.

### 6. Roll20 sem digitar nada
- Botão discreto **R20** em cada poder, talento, item mágico e passiva: copia a macro `&{template:dnd4epower}` pronta, com ataque, dano, crítico (dano máximo), ataques múltiplos em áreas e alcance. Dano com duas armas (como o Whirling Frenzy) usa as duas armas.
- **📋 Copiar p/ Roll20** monta a **ficha completa** com os campos da ficha oficial "D&D 4E": atributos, defesas, perícias, armas, poderes e habilidades. Funciona com o script de API (plano Pro) ou com uma **extensão para navegadores Chrome/Brave** que acompanha o pacote (sem Pro).
- Criaturas também vão para o Roll20 com os poderes já nos espaços de poder.

### 7. Importar e exportar
- **Importa** `.dnd4e` do Character Builder (inclusive o diário, que vira janelas de anotações), PDF editável e `.json`.
- **Exporta** para `.dnd4e` (formato do Character Builder), **PDF editável** (com campos calculados e campos para você preencher) e `.json`.
- Ida e volta testada em fichas reais: as escolhas, talentos, poderes, itens, perícias e anotações voltam idênticos.

---

## Como usar
1. Baixe o zip, extraia e dê dois cliques em **INICIAR GRIMORIO.bat**. Se faltar o Node.js, ele instala sozinho.
2. O navegador abre em `http://localhost:3102`. O compêndio e a tradução já vêm no pacote.
3. Crie uma ficha (ou importe a sua), compre e equipe os itens e copie as macros para a sua mesa.

## O que ainda é honesto avisar
- A fonte do compêndio é de terceiros e **não oficial**; o aplicativo não é afiliado à Wizards of the Coast.
- A tradução foi feita por IA com glossário e revisão automática; **ainda pode haver trechos estranhos**. Avise para corrigirmos.
- A integração com o Roll20 e a abertura dos arquivos exportados no Character Builder foram testadas em simulação e em arquivos reais lidos de volta, mas **ainda não foram validadas dentro do Roll20 nem do Character Builder de verdade**. Se algo falhar, conte para nós.
- Escolhas muito internas de algumas classes e antecedentes podem exigir ajuste manual de 1 a 3 pontos.
- Os textos dos monstros importados estão sendo traduzidos; as descrições longas podem ainda aparecer em inglês em alguns casos.

## Para o mestre e para a mesa
Um aplicativo feito por jogador para jogador: leve, em português, que roda sem internet, não pede cadastro e deixa todos os dados no seu computador. Experimente, quebre, mande sugestões.

*Grimório do Aventureiro — para quem ainda joga a 4ª edição.*
