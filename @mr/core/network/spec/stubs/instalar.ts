/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: e7050e979f03530f7dee4d769f8c9d74
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import Module from "node:module";
import path from "node:path";

/**
 * Los `exports` de `services-comun` y `@mr/core-i18n` apuntan a `.ts`, que `node --test` no resuelve sin
 * bundler. Este módulo se importa **el primero** en cada spec (TypeScript conserva el orden de los
 * `import` al emitir CommonJS) y redirige esos especificadores a las réplicas de `spec/stubs`.
 */

const SUSTITUTOS: Record<string, string> = {
    "services-comun/modules/utiles/log": "log",
    "services-comun/modules/utiles/promise": "promise",
    "services-comun/modules/utiles/fs": "vacio",
    "services-comun/modules/utiles/stream": "vacio",
    "@mr/core-i18n/langs": "vacio",
};

type TResolver = (request: string, ...resto: unknown[]) => string;
const modulo = Module as unknown as {_resolveFilename: TResolver};
const original = modulo._resolveFilename;
modulo._resolveFilename = function (this: unknown, request: string, ...resto: unknown[]): string {
    const sustituto = SUSTITUTOS[request];
    if (sustituto !== undefined) {
        return path.join(__dirname, `${sustituto}.js`);
    }

    return original.call(this, request, ...resto);
};
