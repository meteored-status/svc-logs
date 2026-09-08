/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 5e156d52e5e48deaa7273abf976fc240
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {MRLang} from "./mrlang";

// La raiz del monorepo, no un conteo de `..`: este workspace cuelga tres niveles del raiz
// (`@mr/core/i18n`) y el anterior colgaba de dos (`@mr/cli`), asi que el relativo que habia
// aqui apuntaba a `@mr`. `MRPACK_ROOT` lo fija `bin/mrlang.js` desde su propio `__dirname`,
// que es el unico sitio del proceso que sabe donde esta instalado.
process.chdir(process.env["MRPACK_ROOT"] ?? process.cwd());

MRLang.run();
