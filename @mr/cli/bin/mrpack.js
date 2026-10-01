#!/usr/bin/env node
// dotenv 18 imprime «◇ injected env (N) from .env» en cada carga, y `dotenv/config` se importa desde
// `src/clases/manifest/root/index.ts`, así que ese banner salía antes incluso de la cabecera de MRPack y
// ensuciaba la salida de todos los comandos. Se silencia aquí, y no cambiando aquel import por una llamada
// con `{quiet: true}`, porque el import de efecto se evalúa **antes** que el resto de imports del módulo: una
// llamada explícita correría después, y cualquier módulo que leyera `process.env` al cargarse vería otra cosa.
process.env.DOTENV_CONFIG_QUIET ??= "true";

// __dirname es @mr/cli/bin → la raíz del monorepo siempre está tres niveles arriba.
// Calcularlo aquí es más robusto que process.cwd(), que puede variar según cómo Yarn
// invoque el bin (PnP puede arrancar desde el directorio del workspace, no desde la raíz).
process.env.MRPACK_ROOT = require("path").resolve(__dirname, "../../..");
require("@mr/core-cli/arranque")({modulo: "mrpack", workspace: "@mr/cli", bin: __dirname});
