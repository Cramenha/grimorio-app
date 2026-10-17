# Grimório do Aventureiro / Adventurer's Grimoire

PT: Fichas e anotações de D&D 4e, rodando local (Node + navegador). Este repositório tem **tudo** que o app
precisa pra rodar completo: código, compêndio, regras e tradução para português.

EN: D&D 4e character sheets and notes, running locally (Node + browser). This repository has **everything**
the app needs to run complete: code, compendium, rules and Portuguese translation.

## Instalar / Install
1. Instale o Node 24+ / Install Node 24+.
2. `git clone` este repo.
3. `npm install --omit=dev` e `node server.js`, abra http://localhost:3102.

Os dados do usuário ficam em `dados/` (não vai para o Git). / User data lives in `dados/` (not in Git).

## Windows (.exe)
- **Usuário / User:** baixe `Grimorio-Windows-vX.zip` em *Releases*, extraia e abra `Grimorio.exe` (Node já vem dentro). Download `Grimorio-Windows-vX.zip` from *Releases*, extract, run `Grimorio.exe` (Node bundled).
- O botão **↻** no topo verifica atualizações; quando há uma, vira **Baixar atualização / Download update**. Fichas (`dados/`) nunca são tocadas. / The **↻** button checks for updates; sheets are never touched.
- **Mantenedor / Maintainer:** `node construir-exe.mjs` gera `dist/Grimorio-Windows-vX.zip` e `dist/Grimorio-atualizacao-vX.zip`; publique um Release com tag `vX.Y.Z` e anexe os dois zips (o zip de atualização precisa ter "atualizacao" no nome). Aumente `version` no `package.json` antes.

## Contribuindo / Contributing
Só o dono publica versões. Qualquer pessoa pode abrir *Issues* e *Pull Requests*; todo PR é revisado antes de entrar. / Only the owner publishes releases. Anyone can open Issues and Pull Requests; every PR is reviewed.
