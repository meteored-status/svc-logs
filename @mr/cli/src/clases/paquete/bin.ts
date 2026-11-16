/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 09:46:04 GMT
 * Hash: a64813119173fab26ca1b91dacc6546f
 * Versión: 2026.11.16+4-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-proxy.git
 */

import {md5Dir, readFileString, safeWrite} from "@mr/core-cli/fs";

import {Comando} from "../comando";

/**
 * Resultado de {@link compilarBinMin}.
 *
 * @property ok     - `true` si la compilación terminó con código 0.
 * @property stderr - Salida de error del compilador, para el mensaje cuando `ok` es `false`.
 */
export interface IResultadoCompilarBin {
    ok: boolean;
    stderr: string;
}

/**
 * Lee un fichero de lista (una entrada por línea) como líneas recortadas y sin vacías.
 * Si no existe, devuelve una lista vacía.
 */
async function leerLista(file: string): Promise<string[]> {
    const data = await readFileString(file).catch(() => "");
    return data.split("\n").map(l => l.trim()).filter(l => l.length > 0);
}

/**
 * Indica si un paquete envía su `bin/min` al bucket: `bin/.mr-bin` lo lista (el receptor lo
 * sobrescribe sin merge) y `bin/.mr-ignore` no lo excluye. Hoy solo `@mr/cli`; `@mr/core-i18n`
 * lo excluye y cada monorepo lo compila por su cuenta.
 *
 * @param dir - Ruta absoluta del paquete.
 */
export async function enviaBinMin(dir: string): Promise<boolean> {
    const [bin, ignore] = await Promise.all([
        leerLista(`${dir}/bin/.mr-bin`),
        leerLista(`${dir}/bin/.mr-ignore`),
    ]);

    return bin.includes("min") && !ignore.includes("min");
}

/**
 * Compila el paquete en modo producción (`yarn run compile`) y, si sale bien, anota en
 * `bin/hash.md5` el md5 del `bin/min` resultante. Si falla no toca `bin/hash.md5`: con el hash de
 * antes, el siguiente arranque detecta que el bundle no cuadra y lo vuelve a intentar.
 *
 * @param dir - Ruta absoluta del paquete.
 */
export async function compilarBinMin(dir: string): Promise<IResultadoCompilarBin> {
    const {status, stderr} = await Comando("yarn", ["run", "compile"], {cwd: dir});
    if (status !== 0) {
        return {ok: false, stderr};
    }
    await safeWrite(`${dir}/bin/hash.md5`, await md5Dir(`${dir}/bin/min`), true);

    return {ok: true, stderr};
}
