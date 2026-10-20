# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Grimório do Aventureiro: fichas, anotações e compêndio de D&D 4e (estilo Character Builder), 100% local, sem IA e sem login em tempo de uso. Código, comentários, UI e commits em **português**; a UI é bilíngue (botão 🌐 PT/EN para o texto do compêndio).

## Comandos

- `npm start`: app desktop (Electron), a **versão oficial**. Porta 3103; fichas em `%APPDATA%\Grimório do Aventureiro\dados`.
- `npm run web`: o mesmo app servido só pelo `server.js` em <http://localhost:3102> (base de uma futura versão web; usado para verificar com Reticle no navegador). Dados em `dados/` ao lado do código e sem atualizador (o ↻ responde "só no app instalado").
- `npm run desktop:instalador`: gera `dist-desktop\Grimorio-Setup-X.Y.Z.exe` (com `compendio/` em `extraResources`). `npm run desktop:publicar`: publica o Release com `latest.yml` (precisa de `GH_TOKEN`; aumente `version` no `package.json` antes).
- Rodando dentro do terminal do VS Code, `ELECTRON_RUN_AS_NODE=1` é herdado e o Electron vira Node puro (erro "does not provide an export named 'BrowserWindow'"): rode com `env -u ELECTRON_RUN_AS_NODE npx electron .`.

Não há lint nem build do front (JavaScript puro, sem bundler). Testes são scripts Node avulsos:

- `node teste-poder-stats.mjs`: testes de acerto/dano por poder (autossuficiente).
- `node teste-calculo.mjs <ficha.dnd4e> ...`: compara o cálculo com os valores gravados pelo Character Builder (sem argumentos não faz nada). Fichas de exemplo: `C:\CharacterBuilder\SampleChars\SampleHeroes\*.dnd4e`.
- `node teste-export-dnd4e.mjs [pasta]`: ida e volta .dnd4e → ficha → .dnd4e (pasta padrão acima). A diferença no YoungRaistlin ("Belt Pouch") já existia antes.

## Arquitetura

- **Um servidor, dois invólucros.** `server.js` (Node `http`, sem framework) serve a API `/api/*`, a lista fixa de estáticos (`ESTATICOS`: `index.html`, `app.js`, `criatura.js`, `style.css`, `tema.js`, `manual/manual.html`) e `/vendor/*` (Bootstrap e `@fontsource` direto de `node_modules`; o app precisa funcionar offline, então **nada de CDN** no app). `electron/main.mjs` importa o `server.js`, espera o `pronto` exportado e abre uma `BrowserWindow` em `localhost:3103`. Arquivo estático novo precisa entrar em `ESTATICOS`, e pacote novo de `vendor` em `VENDOR`.
- **Caminhos via `caminhos.mjs`.** `DADOS` e `COMPENDIO` vêm de `GRIMORIO_DADOS` / `GRIMORIO_COMPENDIO` (o Electron define para fora da pasta de instalação) ou ficam ao lado do código. Todo módulo que lê `compendio/` ou `dados/` deve importar daqui, nunca montar o caminho com `import.meta.url`.
- **Atualização injetável.** `server.js` usa `globalThis.grimorioAtualizador`, que o Electron define com o `electron-updater` (Releases com `latest.yml`). Sem ele, `/api/versao` devolve `motivo: 'dev'`. O pacote antigo (`Grimorio.exe` com launcher C#, `.bat`, atualizador por zip) foi removido; quem vem dele migra com *Backup de tudo* → *Restaurar backup*.
- **Dados.** Cada ficha é um JSON em `dados/personagens/`; personagens e criaturas (`tipo: 'criatura'`) usam a mesma rota. Backup rotativo em `dados/backups/`, excluídos em `dados/lixeira/`.
- **Compêndio** (`compendio/*.json`, versionado): cópia do iws.mx (`baixar-compendio.mjs`) + arquivos derivados gerados por ferramentas de quem mantém: `pt.json` (tradução por trecho de texto, ver `segmentos.mjs`), `regras.json` (regras extraídas do CB), `efeitos.json`, `cb-ids.json`, `pt-campos.json`. As ferramentas `traduzir*`, `revisar-traducao`, `extrair-*` usam o Claude Agent SDK (devDependency) e rodam uma vez; o app em uso só lê os arquivos prontos.
- **Motor de regras.** `calculo.mjs` é o centro: soma bônus tipados (mesmo tipo não empilha) de raça, classe, talentos e itens a partir de `regras.json`, com `passivas.mjs` (passivas de itens em texto) como reserva. `calcular(P)` devolve totais e `origem.<stat>` (linhas de bônus com fonte/tipo/aplicado), que alimentam o tooltip da UI e o export do Foundry. `poder-stats.mjs` é a **única** fonte de acerto/dano por poder (Builder, Sheet, Roll20) e usa `efeitos-ficha.mjs`/`efeitos-texto.mjs`.
- **Importar/exportar**, todos a partir de `calcular()`: `importar.mjs` (.dnd4e) ↔ `dnd4e-export.mjs`; `pdf-ficha.mjs` (PDF editável, ida e volta); `roll20.mjs` (macros `dnd4epower`) + `roll20-ficha.mjs` (lido pelo `grimorio-importador.js` da API do Roll20 e pela `extensao-roll20/`); `foundry-ficha.mjs` (Actor do sistema dnd4e do Foundry, com a diferença dos totais em "untyped"). Criaturas: `criatura.mjs` (servidor) e `criatura.js` (editor no front).
- **Front.** `app.js` é um script clássico com estado global (`P` = ficha aberta, `CALC` = último cálculo, `aba`, `IDIOMA`) e helpers (`$`, `api`, `esc`, `toast`, `modal`, `agendarSalvar`) que o `criatura.js` reutiliza. As telas são templates de string re-renderizados por inteiro.

## Design

`DESIGN.md` define o design system (Material Design 3 inspirado no foundryvtt.com, temas claro e escuro, Cinzel + Signika). Use os tokens `--md-*` e `--shape-*` do `style.css`; cor nova entra nos dois blocos de tema (`:root` e `:root[data-tema="claro"]`). Não use cores fixas nem os tokens do tema antigo (`--ouro*`, pergaminho). O tema vem do `tema.js` (sistema, ou a escolha do botão ☀/☾ salva em `localStorage`). O manual (`manual/manual.html`, servido pelo app) usa os mesmos tokens; para regerar o PDF, imprima `http://localhost:3102/manual/manual.html?tema=claro` (ex.: Edge headless `--print-to-pdf`) e grave em `manual/Grimorio-do-Aventureiro-Manual.pdf`. Os selos de tipo de poder (à vontade/encontro/diário) são regra do jogo, não decoração.

Ordem de precedência em trabalho de UI: `DESIGN.md` dá a direção, o antislop (bloco no fim deste arquivo) filtra, e as skills abaixo dão técnica. Se uma skill contradiz o `DESIGN.md` (ex.: tracking dos títulos em Cinzel, state layers do M3), vale o `DESIGN.md`.

Skills de UI do projeto (`.claude/skills/`), reescritas em português para o stack e a direção daqui (Bootstrap 5, templates de string, tokens `--md-*`, MOTION 2). Ao atualizar uma delas a partir da origem, reaplique a adaptação, porque o texto original assume outro stack:

- `interface-design` (veio do frota): construir ou refinar telas.
- `baseline-ui` (de ibelick/ui-skills): passada rápida de polimento ou revisão de um arquivo contra o básico.
- `improve-ui` (de ibelick/ui-skills): auditoria somente leitura que gera planos em `design-plans/`.
- `fixing-accessibility` (de ibelick/ui-skills): acessibilidade, já com as pendências conhecidas (nenhum `aria-*`, botões só de ícone, `div`/`span` clicáveis).
- `fixing-motion-performance` (de ibelick/ui-skills): animação dentro do MOTION 2, incluindo o `prefers-reduced-motion` que ainda falta.
- Não instaladas (ibelick/ui-skills): `component-canvas` (pressupõe componentes de framework), `fixing-metadata` (SEO/Open Graph, sem uso num app desktop; rever se houver versão web pública), `create-design-md` (o `DESIGN.md` já existe) e `ui-skills-root`/MCP do registro (baixam instruções em tempo de execução).

## MCPs do projeto (`.mcp.json`)

- `electron`: Playwright MCP ligado por CDP à janela real do app. Abra antes com `npm run desktop:debug` (Electron com `--remote-debugging-port=9222`); sem isso as ferramentas falham ao conectar. Use para o que o Reticle não alcança: janela, menu, atualizador, fichas em `%APPDATA%`.
- `fichas`: leitura de `%APPDATA%\Grimório do Aventureiro\dados` (fichas reais do app instalado). As ferramentas de escrita estão bloqueadas em `.claude/settings.json`; a pasta só existe depois da primeira execução do app.

## Reticle neste projeto

O renderer é uma página HTML pura: o snippet de conexão está no fim do `index.html` e só conecta se `reticle.local.js` trouxer um token. O arquivo é gitignored e fica fora dos dois pacotes; sem ele (e sempre dentro do Electron, que também roda em localhost) o `server.js` devolve um módulo com `token = null`, em vez de 404, para não sujar o console do app. Para verificar: `npm run web` e abrir <http://localhost:3102>. O estado do app fica no store `grimorio` (`reticle_look { action: "state", store: "grimorio" }`).

<!-- reticle:begin (managed by `reticle init` — edit outside these markers) -->
## Verifying with Reticle

This app is instrumented by **Reticle**, an in-app verification layer exposed as `reticle_*` MCP tools and the `npx @reticlehq/server` CLI (always through npx: Reticle's server is not installed into this project). Verifying is part of "done", not an optional extra.

**Verify when you have changed something a user can see or do.** A component, a form, a route, a request, a piece of state that reaches the screen. Do it BEFORE telling the user it is complete. Reading the diff proves nothing and unit tests do not run the app.

**Do not reach for Reticle when the change cannot show up in the running app.** It costs tool calls and the user's patience, and a verdict over an unrelated flow proves nothing about what you changed. Skip it for: documentation, comments, tests, build config, CI, dependency bumps with no user-facing effect, backend or CLI work with no UI surface, and any change to a project that is not a running web app. Say in one line that you skipped verification and why, rather than silently not doing it.

**How to verify — the rules to keep in mind on every call:**

1. **Only `verified: "yes"` is a pass.** `"no-fault"` (nothing was declared — you omitted `until`) and `"unknown"` (Reticle could not tell; `verifiedReason` says why) are not a pass: report them as not proved, never as working.
2. **Name the consequence BEFORE acting:** `reticle_act_and_wait({ target, action, until })` (add `durable: true` if it must survive a reload). Only it, `reticle_assert` and `reticle_act { steps }` produce a verdict; everything else proves nothing.
3. **A journey is one call:** `reticle_act { steps: [{ target, action, expect }] }` runs every step and stops at the first `expect` that fails. The last step's `expect` is the end state you were asked to deliver.
4. **Text checks are exact-case.** Add `ignoreCase: true` only when case truly does not matter.
5. **Target by `{ testid }` or `{ role, name }`.** An ambiguous target is refused, never guessed.
6. **On a failure, read `expected` / `observed` / the nearest candidates before retrying.** Never weaken a check to make it green.
7. **Open `screenshot.path` only when the look matters;** `reticle_observe { since }` has the rest.
8. **Predicates:** `{ kind: "signal", name }` · `{ kind: "net", method, urlContains, status }` · `{ kind: "route", pathname }` · `{ kind: "state", path, equals }` · `{ kind: "element", query: { role, name } }` · `{ kind: "text", contains }` · `allOf` / `anyOf` / `not`.
9. **No session?** `reticle_session { action: "list" }` and do its `next_action`. **No app connected at all?** Run `npx @reticlehq/server init` in the app's own folder yourself. **A version-skew warning?** `npx @reticlehq/server stop`, then retry.
10. **End with the Reticle result block the server gives you**, verbatim.
11. **If your context was compacted or you lost track, run `npx @reticlehq/server context --compact` first.** It is the daemon's own record of what was proved, what failed and what is still owed.

Covered flows: `npx @reticlehq/server gate` reports which recorded flows the changed files affect and whether they still pass.

**Setting Reticle up? You are mid-sequence — do not stop until a verdict exists.** The whole of it
is: instrument the app → get a dev server running → open the app in a browser → drive one flow →
report the verdict. Every step is yours to do, and none of them needs the user. Stopping short leaves an app that
looks installed and can verify nothing, which is the commonest way this goes wrong. `/reticle`
carries the recovery ladder; never report the install as finished without a verdict to point at.

**Nothing connected? Get the app running.**

**A dev server already running when `reticle init` ran does not have Reticle in its bundle.** It read the build config at boot; `init` edited it afterwards. It serves the old bundle and no session appears. In order:

1. **A dev server was already running?** Restart it, then hard-reload the tab. "Something is listening" does not mean the right bundle is served.
2. **Nothing was running?** Start it in the BACKGROUND and say so in one line. `reticle_session { action: "list" }` gives you this project's own dev command in `next_action`; use that, never compose one. Started after `init`, it needs no restart.

Stopping to ask is how a verification turn ends with nothing verified.

Four guards, none optional:

1. **Never run two at once.** One dev server on the app's port. Restarting a stale one means stopping it first, not starting a second alongside it.
2. **Never guess the command.** It comes from `package.json` scripts. No recognisable dev script means say so and stop, not invent one.
3. **Never kill anything you did not start**, and never a daemon or a port holder. The one exception is the restart above, and say in one line that you did it.
4. **The permission prompt belongs to your host.** Never bypass, suppress or auto-approve it, and take a refusal as the answer.

If a server IS listening and still nothing connects, the cause is the SDK not loading in the page, not a missing dev server; do not tell the user to start one they are already running.

**Finish `src/reticle-dev.ts` before you claim setup is done.** `init` writes it and cannot always fill it in: a store that needs an argument only reading the code supplies (Jotai atoms, an XState actor, a TanStack `queryClient`) is left as a commented `registerStore` line. A file that registers nothing looks exactly like a finished one, and `reticle_look { action: "state" }` then returns empty forever — which is indistinguishable from an app that has nothing to report, so it reads as success. Uncomment the line, complete it, and prove it by driving one flow and seeing your keys come back. If `init` told you to restart your client, this is the job waiting for you on the other side of that restart.

**Verify each feature as you finish it, not all of them at the end.** Asked for four, build one, drive it, get a verdict, then start the second. A red verdict after four builds has four suspects; after one it has none.

**Capture what a change is FOR while you are building it, not afterwards.** The business outcome a change is meant to produce is known only while the change is being made. Pass `intent` when a flow is saved, so the saved flow carries the reason it exists. A flow without one replays for months and then reports "step 3 failed" instead of what stopped being true for a user.

**Honesty, which is the whole point:**

- **If Reticle cannot run** (no daemon, or this is not a running web app), say so. Do not skip verification silently.
- **Setup is not finished until one real flow has been driven and produced a verdict.** `init` exiting 0, the tools appearing, and a session being listed are all things that happen before anything has been verified.

**The `/reticle` skill runs this whole loop for you** — detect, connect, drive one flow, report. If your client does not have it, install it once: `/plugin marketplace add reticlehq/reticle` then `/plugin install reticle@reticlehq` in Claude Code, or `npx skills add reticlehq/reticle` anywhere the skills CLI works.

**A tool you need is missing?** Call `reticle_tools` before assuming it: this surface merges several families behind an `action`, so what looks absent is usually one argument away. It is the verify loop and nothing else on purpose, and a daemon started with `RETICLE_ADVERTISE_ALL_TOOLS=1` advertises the wider set — it reads that at startup, so it takes effect on the next one.

**Report Reticle's own defects with `reticle_session { action: "feedback" }` the moment you notice**, then carry on with your task. You are the user Reticle is built for and the only one who can say what it cost you, and that knowledge is gone when your context is.

📄 **The rest is in [RETICLE.md](./RETICLE.md): what to do when the tools are missing, when a result carries `version_skew` or `update_available`, when `reticle_look { action: "state" }` comes back empty, and how to write a feedback report that can be acted on. Read it when you hit one of those, not before.**
<!-- reticle:end -->

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `.claude/skills/antislop/SKILL.md` (core) and then the skill for the task:
- UI / visual: `.claude/skills/antislop-ui/SKILL.md`
- Copy & text: `.claude/skills/antislop-copywriting/SKILL.md`
- People: `.claude/skills/antislop-human/SKILL.md`
- Mobile / responsive: `.claude/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `.claude/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: download `antislop.md` again, or run `npx antislop-ai --update` if it was installed as skill folders.
<!-- antislop:end -->
