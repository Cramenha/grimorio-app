// Onde ficam as fichas (dados\) e o compêndio (compendio\). Por padrão, ao lado do app (como sempre foi);
// o app desktop (Electron) aponta para fora da pasta de instalação com GRIMORIO_DADOS / GRIMORIO_COMPENDIO.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = path.dirname(fileURLToPath(import.meta.url));
export const DADOS = process.env.GRIMORIO_DADOS || path.join(APP, 'dados');
export const COMPENDIO = process.env.GRIMORIO_COMPENDIO || path.join(APP, 'compendio');
