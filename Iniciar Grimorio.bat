@echo off
rem Inicia o Grimorio do Aventureiro. Link: http://localhost:3102
set "PATH=%PATH%;C:\Program Files\nodejs;%USERPROFILE%\.local\bin"
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instalando com winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo Node instalado. FECHE esta janela e abra este arquivo de novo.
  pause
  exit /b 0
)

if not exist node_modules call npm install --omit=dev

rem baixa o compendio do iws.mx se faltar (ja vem incluso neste repositorio)
if not exist compendio\power.json node baixar-compendio.mjs

start "" http://localhost:3102
node server.js
pause
