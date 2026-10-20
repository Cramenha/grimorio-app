# Grimório do Aventureiro / Adventurer's Grimoire

PT: Fichas e anotações de D&D 4e no estilo do Character Builder, num app desktop que roda no seu computador, sem login e sem internet. Este repositório tem **tudo** que o app precisa: código, compêndio, regras e tradução para português.

EN: D&D 4e character sheets and notes in the style of the Character Builder, in a desktop app that runs on your computer, with no login and no internet. This repository has **everything** the app needs: code, compendium, rules and Portuguese translation.

## O que faz / What it does

- Monta e calcula a ficha como o Character Builder: defesas, PV, perícias, ataques e bônus de itens equipados (passe o mouse num número para ver de onde vem cada bônus). / Builds and calculates the sheet like the Character Builder.
- Compêndio inteiro do iws.mx em português, com o nome original sempre visível; o botão 🌐 alterna o texto entre PT e EN. / Full compendium, translated to Portuguese.
- Grimório de poderes, anotações flutuantes e criaturas para o mestre. / Power cards, floating notes and creatures for the DM.
- Importa `.dnd4e` (Character Builder), PDF editável e `.json`; exporta para `.dnd4e`, PDF editável, Roll20 (macros e ficha completa) e Foundry VTT. / Imports and exports Character Builder, PDF, Roll20 and Foundry VTT.
- Tema claro e escuro: começa no tema do sistema e o botão ☀/☾ troca. O botão 📖 Manual abre o manual do usuário. / Light and dark themes; the 📖 Manual button opens the user guide.

## Instalar / Install

- **Usuário / User:** baixe `Grimorio-Setup-X.Y.Z.exe` em *Releases* e execute. O app abre em janela própria e as fichas ficam em `%APPDATA%\Grimório do Aventureiro\dados` (menu *Arquivo > Abrir pasta das fichas*). / Download `Grimorio-Setup-X.Y.Z.exe` from *Releases* and run it. Sheets live in `%APPDATA%\Grimório do Aventureiro\dados`.
- O botão **↻** no topo verifica atualizações; quando há uma, vira **Baixar atualização / Download update**. Fichas nunca são tocadas. / The **↻** button checks for updates; sheets are never touched.
- **Vindo da versão antiga (`Grimorio.exe` ou `.bat`)?** Abra a versão antiga, clique em *Backup de tudo (.json)* e, no app novo, em *Restaurar backup*. / **Coming from the old version?** Use *Backup de tudo* there and *Restaurar backup* in the new app.

## Desenvolver / Develop

Node 24+ e `npm install`. / Node 24+ and `npm install`.

- `npm start`: abre o app desktop (Electron). / opens the desktop app.
- `npm run web`: o mesmo app servido só pelo `server.js` em <http://localhost:3102>, para testar no navegador (dados em `dados/`, fora do Git). / the same app served by `server.js` alone, for testing in the browser.
- `npm run desktop:debug`: o Electron com a porta de depuração 9222 aberta (usada pelo MCP `electron` do `.mcp.json`). / Electron with remote debugging on port 9222.
- Rodando de dentro do terminal do VS Code, o Electron pode abrir como Node puro (erro `does not provide an export named 'BrowserWindow'`); use `env -u ELECTRON_RUN_AS_NODE npx electron .`. / Inside VS Code's terminal, unset `ELECTRON_RUN_AS_NODE` first.
- `npm run desktop:instalador`: gera `dist-desktop\Grimorio-Setup-X.Y.Z.exe` com o compêndio incluído. / builds the installer.

Testes (scripts Node, sem framework) / Tests:

- `node teste-poder-stats.mjs`: acerto e dano por poder. / per-power attack and damage.
- `node teste-calculo.mjs <fichas.dnd4e>`: compara o cálculo com os valores gravados pelo Character Builder (fichas de exemplo em `C:\CharacterBuilder\SampleChars\SampleHeroes`). / compares against Character Builder values.
- `node teste-export-dnd4e.mjs [pasta]`: ida e volta `.dnd4e` → ficha → `.dnd4e`. / `.dnd4e` round trip.

O `CLAUDE.md` descreve a arquitetura, e o `DESIGN.md`, o design system. / `CLAUDE.md` covers the architecture; `DESIGN.md`, the design system.

## Publicar / Release

Aumente `version` no `package.json`, defina `GH_TOKEN` (de uma conta com acesso de escrita a este repositório) e rode `npm run desktop:publicar`. Isso cria o Release com o instalador e o `latest.yml`, que a atualização automática do app lê. Até o primeiro Release, o ↻ do app instalado responde que não há atualizações. / Bump `version`, set `GH_TOKEN` (an account with write access) and run `npm run desktop:publicar`. Until the first Release exists, the installed app's ↻ reports no updates.

## Contribuindo / Contributing

Crie a branch a partir da `main` (`git switch -c minha-branch main`) e abra um *Pull Request*; todo PR é revisado antes de entrar. Qualquer pessoa pode abrir *Issues*. Só quem mantém o repositório publica versões. / Branch from `main` and open a Pull Request; every PR is reviewed. Anyone can open Issues. Only maintainers publish releases.
