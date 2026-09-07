// La compilación vive en `@mr/core-cli/esbuild`, compartida con `mrlang`. Aquí solo lo propio: el
// punto de entrada y, en watch, arrancar de paso el de `mrlang`.
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

import {compilar} from "@mr/core-cli/esbuild";

// La raíz del monorepo: este fichero está en `@mr/cli/src`, así que son tres niveles arriba.
const raiz = resolve(fileURLToPath(import.meta.url), "../../../..");

/**
 * El workspace de `mrlang`, si está instalado en este monorepo.
 *
 * `mrlang` vivía aquí hasta el 2026-09-04 y un solo `compile:watch` construía los dos CLI. Al
 * separarlos, quien toca las herramientas se quedó con dos watches que arrancar a mano. Esto lo
 * devuelve sin volver a acoplar los paquetes: no se importa su configuración, se lanza **su
 * propio** script de compilación.
 *
 * Se comprueba si existe porque los dos paquetes se envían por separado: un monorepo puede tener
 * `@mr/cli` sin `@mr/core-i18n`, y en ese caso esto no hace nada.
 *
 * @returns La ruta del workspace, o `null` si no está.
 */
function buscarMrlang() {
    const dir = resolve(raiz, "@mr/core/i18n");
    if (!existsSync(resolve(dir, "package.json")) || !existsSync(resolve(dir, "src/esbuild.config.mjs"))) {
        return null;
    }

    return dir;
}

/**
 * Lanza el `compile:watch` de `mrlang` como proceso hijo, heredando la salida.
 */
function watchMrlang(dir) {
    console.log(`esbuild: @mr/core-i18n detectado, compilando mrlang también (${dir})`);
    const hijo = spawn("yarn", ["workspace", "@mr/core-i18n", "run", "compile:watch"], {
        cwd: raiz,
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    // Al cerrar este proceso, cerrar el hijo: sin esto queda un esbuild huérfano en watch.
    let cerrando = false;
    const cerrar = () => {
        cerrando = true;
        hijo.kill();
    };
    process.on("exit", cerrar);
    process.on("SIGINT", () => {
        cerrar();
        process.exit(0);
    });
    process.on("SIGTERM", cerrar);

    // Si el hijo se cae solo se avisa, pero no se tumba este watch: mrpack es lo principal.
    //
    // El flag es necesario: al cerrar con Ctrl+C, `yarn` traduce la señal a un código de salida
    // (129 = 128+SIGHUP), así que sin él un cierre normal se reportaría como error.
    hijo.on("exit", (code) => {
        if (!cerrando && code !== 0 && code !== null) {
            console.error(`esbuild: el watch de mrlang ha terminado con código ${code}`);
        }
    });
}

await compilar({
    url: import.meta.url,
    entry: {"mrpack": "main.ts"},
    watch: process.argv.includes("--watch"),
    // Solo en watch, y a propósito. `compile` está en el camino caliente del arranque, que lo
    // lanza cuando falta `bin/min/mrpack-run.js`: compilar allí un CLI que no se ha pedido sería
    // trabajo de más.
    alWatch: () => {
        const mrlang = buscarMrlang();
        if (mrlang !== null) {
            watchMrlang(mrlang);
        }
    },
});
