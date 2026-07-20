#!/usr/bin/env node
// __dirname es @mr/cli/bin → la raíz del monorepo siempre está tres niveles arriba.
// Calcularlo aquí es más robusto que process.cwd(), que puede variar según cómo Yarn
// invoque el bin (PnP puede arrancar desde el directorio del workspace, no desde la raíz).
process.env.MRPACK_ROOT = require("path").resolve(__dirname, "../../..");
require("./lib")("mrpack");
