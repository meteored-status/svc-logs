#!/usr/bin/env node
// __dirname es @mr/cli/bin → la raíz del monorepo siempre está tres niveles arriba.
process.env.MRPACK_ROOT = require("path").resolve(__dirname, "../../..");
require("./lib")("mrlang");
