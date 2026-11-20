/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: a458eea92a024bd5ea756d89d819be96
 * Versión: 2026.11.18+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import Module from "node:module";
import path from "node:path";

/**
 * Los `exports` de `services-comun` y de `@mr/core-log` apuntan a `.ts`, que `node --test` no resuelve sin
 * bundler. Este módulo se importa **el primero** en cada spec (TypeScript conserva el orden de los
 * `import` al emitir CommonJS) y redirige esos especificadores: `services-comun` a las réplicas de
 * `spec/stubs`, y `@mr/core-log/interface` y `@mr/core-network/server/http/config/net` (solo constantes) al `.js` que
 * TypeScript emite junto a las pruebas. `dd-trace` (que usa `WSPool`) va a un doble sin traza activa.
 */

const SUSTITUTOS: Record<string, string> = {
    "services-comun/modules/utiles/log": path.join(__dirname, "log.js"),
    "services-comun/modules/utiles/promise": path.join(__dirname, "promise.js"),
    "services-comun/modules/utiles/fs": path.join(__dirname, "vacio.js"),
    "dd-trace": path.join(__dirname, "dd-trace.js"),
    "dd-trace/ext": path.join(__dirname, "dd-trace.js"),
    "@mr/core-log/interface": path.join(__dirname, "../../../log/modules/interface.js"),
    "@mr/core-network/server/http/config/net": path.join(__dirname, "../../../network/server/http/config/net.js"),
};

type TResolver = (request: string, ...resto: unknown[]) => string;
const modulo = Module as unknown as {_resolveFilename: TResolver};
const original = modulo._resolveFilename;
modulo._resolveFilename = function (this: unknown, request: string, ...resto: unknown[]): string {
    const sustituto = SUSTITUTOS[request];
    if (sustituto !== undefined) {
        return sustituto;
    }

    return original.call(this, request, ...resto);
};
