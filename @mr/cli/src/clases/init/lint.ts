/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 28cb7f6ad8dba1b91cf9fd6f146877ae
 * Versión: 2026.9.23+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {isFile, readJSON, safeWrite, unlink} from "@mr/core-cli/fs";

import type {IPackageJson} from "../packagejson";

/**
 * Contenido del `eslint.config.mjs` de la raíz. Es una línea a propósito: la configuración vive en
 * `@mr/core-lint/config`, que es framework y llega a cada monorepo con el siguiente `update`, y aquí
 * solo se reexporta.
 *
 * Es un fichero y no un enlace simbólico, como sí lo son `AGENTS.md` o `.github`. Con PnP, quién
 * importa un paquete depende de dónde está **de verdad** el fichero, porque Node sigue el enlace
 * antes de resolver: un `eslint.config.mjs` enlazado a `@mr/core/dev`, que es donde viven los demás
 * canónicos, importaría como `@mr/core-dev`, que no declara `@mr/core-lint`, y fallaría al arrancar.
 * Enlazarlo a `@mr/core/lint` sí funcionaría, pero un fichero de una línea se ahorra la casuística
 * de los enlaces en Windows (`symlinks.ts`) y no depende de nada de eso.
 */
const CONFIG = `export {default} from "@mr/core-lint/config";\n`;

/**
 * Deja la raíz del monorepo preparada para `yarn lint`: sus `devDependencies`, los scripts `lint` y
 * `lint:fix`, y el `eslint.config.mjs`.
 *
 * Las `devDependencies` de la raíz **se fijan, no se completan**: quedan exactamente `eslint` y
 * `@mr/core-lint`, y cualquier otra que hubiera desaparece. Es la misma política que había antes de
 * que existiera el linter —se borraban todas—, con dos excepciones que decide el framework. La raíz no
 * es sitio para dependencias de nadie: la de cada workspace va en su `package.json`.
 *
 * La versión de `eslint` sale del `package.json` de `@mr/core-lint`, y no de aquí, para que haya un
 * solo sitio que cambiar al actualizarla. Si el monorepo no tiene `@mr/core-lint` —no debería, porque
 * `checkCliente()` lo añade, pero puede fallar la descarga— se deja la raíz como antes, sin linter,
 * en vez de declarar un paquete que Yarn no encontraría.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param paquete - `package.json` de la raíz (mutado in-place).
 */
export async function checkLint(basedir: string, paquete: IPackageJson): Promise<void> {
    const lint = await readJSON<IPackageJson>(`${basedir}/@mr/core/lint/package.json`).catch(() => undefined);
    const eslint = lint?.devDependencies?.["eslint"] ?? lint?.peerDependencies?.["eslint"];
    if (eslint === undefined) {
        delete paquete.devDependencies;
        if (paquete.scripts !== undefined) {
            delete paquete.scripts["lint"];
            delete paquete.scripts["lint:fix"];
        }
        if (await isFile(`${basedir}/eslint.config.mjs`)) {
            await unlink(`${basedir}/eslint.config.mjs`);
        }
        return;
    }

    paquete.devDependencies = {
        "@mr/core-lint": "workspace:*",
        "eslint": eslint,
    };
    paquete.scripts ??= {};
    paquete.scripts["lint"] = "yarn eslint";
    paquete.scripts["lint:fix"] = "yarn eslint --fix";
    await safeWrite(`${basedir}/eslint.config.mjs`, CONFIG, true);
}
