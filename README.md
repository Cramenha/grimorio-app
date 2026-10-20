# Grimório do Aventureiro / Adventurer's Grimoire

PT: Fichas e anotações de D&D 4e, num app desktop que roda no seu computador. Este repositório tem **tudo** que o app
precisa pra rodar completo: código, compêndio, regras e tradução para português.

EN: D&D 4e character sheets and notes, in a desktop app that runs on your computer. This repository has **everything**
the app needs to run complete: code, compendium, rules and Portuguese translation.

## Instalar / Install
- **Usuário / User:** baixe `Grimorio-Setup-X.Y.Z.exe` em *Releases* e execute. O app abre em janela própria e as fichas ficam em `%APPDATA%\Grimório do Aventureiro\dados` (menu *Arquivo > Abrir pasta das fichas*). / Download `Grimorio-Setup-X.Y.Z.exe` from *Releases* and run it. Sheets live in `%APPDATA%\Grimório do Aventureiro\dados`.
- O botão **↻** no topo verifica atualizações; quando há uma, vira **Baixar atualização / Download update**. Fichas nunca são tocadas. / The **↻** button checks for updates; sheets are never touched.
- **Vindo da versão antiga (`Grimorio.exe` ou `.bat`)?** Abra a versão antiga, clique em *Backup de tudo (.json)* e, no app novo, em *Restaurar backup*. / **Coming from the old version?** Use *Backup de tudo* there and *Restaurar backup* in the new app.

## Desenvolver / Develop
Node 24+ e `npm install`. / Node 24+ and `npm install`.

- `npm start`: abre o app desktop (Electron). / opens the desktop app.
- `npm run web`: o mesmo app servido só pelo `server.js` em http://localhost:3102, para testar no navegador (dados em `dados/`, fora do Git). / the same app served by `server.js` alone, for testing in the browser.
- `npm run desktop:instalador`: gera `dist-desktop\Grimorio-Setup-X.Y.Z.exe` com o compêndio incluído. / builds the installer.
- **Publicar / Release:** aumente `version` no `package.json`, defina `GH_TOKEN` e rode `npm run desktop:publicar` (cria o Release com o instalador e o `latest.yml`, que a atualização automática lê).

## Contribuindo / Contributing
Só o dono publica versões. Qualquer pessoa pode abrir *Issues* e *Pull Requests*; todo PR é revisado antes de entrar. / Only the owner publishes releases. Anyone can open Issues and Pull Requests; every PR is reviewed.
