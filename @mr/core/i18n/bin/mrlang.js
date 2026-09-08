#!/usr/bin/env node
// __dirname es @mr/core/i18n/bin → la raíz del monorepo está CUATRO niveles arriba, no tres:
// este workspace cuelga de `@mr/core/`, mientras que `@mr/cli` cuelga directamente de `@mr/`.
// Calcularlo aquí y no con process.cwd() es lo robusto, porque PnP puede arrancar el bin desde
// el directorio del workspace en vez de desde la raíz.
process.env.MRPACK_ROOT = require("path").resolve(__dirname, "../../../..");
require("@mr/core-cli/arranque")({modulo: "mrlang", workspace: "@mr/core-i18n", bin: __dirname});
