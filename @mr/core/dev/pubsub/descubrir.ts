/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 96fed771f5cc17a055c6ee21261274e9
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import {readdir, readFile, stat} from "node:fs/promises";
import path from "node:path";

import {FICHERO_DECLARACION} from "./declaracion.ts";

async function esFichero(ruta: string): Promise<boolean> {
    try {
        return (await stat(ruta)).isFile();
    } catch {
        return false;
    }
}

async function esDirectorio(ruta: string): Promise<boolean> {
    try {
        return (await stat(ruta)).isDirectory();
    } catch {
        return false;
    }
}

function leerPatrones(manifiesto: unknown, ruta: string): string[] {
    const workspaces = typeof manifiesto === "object" && manifiesto !== null ? (manifiesto as Record<string, unknown>)["workspaces"] : undefined;
    const patrones = Array.isArray(workspaces) ? workspaces : (workspaces as Record<string, unknown> | undefined)?.["packages"];
    if (patrones === undefined) {
        return [];
    }
    if (!Array.isArray(patrones) || patrones.some((patron) => typeof patron !== "string")) {
        throw new Error(`${ruta}: "workspaces" debe ser una lista de patrones o un objeto {packages: [...]}`);
    }
    return patrones as string[];
}

function patronSegmento(segmento: string): RegExp {
    return new RegExp(`^${segmento.split("*").map((trozo) => trozo.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
}

/**
 * Expande un patrón de workspaces a los directorios que designa, relativos a la raíz y con `/` como separador.
 *
 * Solo admite un nivel de comodín en el último segmento (`dir/*`, `@mr/core/*`, `services-*`) o una ruta exacta, que
 * es lo que usa el `workspaces` del `package.json` raíz; no entiende `**`.
 */
async function expandir(raiz: string, patron: string): Promise<string[]> {
    const limpio = patron.replace(/^\.\//, "").replace(/\/+$/, "");
    const segmentos = limpio.split("/");
    const ultimo = segmentos[segmentos.length - 1] ?? "";
    if (!ultimo.includes("*")) {
        return limpio !== "" && limpio !== "." && await esDirectorio(path.join(raiz, limpio)) ? [limpio] : [];
    }

    const padre = segmentos.slice(0, -1).join("/");
    let entradas: string[];
    try {
        entradas = await readdir(path.join(raiz, padre));
    } catch {
        return [];
    }
    const coincide = patronSegmento(ultimo);
    const encontrados: string[] = [];
    for (const entrada of entradas.filter((nombre) => coincide.test(nombre))) {
        const relativa = padre === "" ? entrada : `${padre}/${entrada}`;
        if (await esDirectorio(path.join(raiz, relativa))) {
            encontrados.push(relativa);
        }
    }
    return encontrados;
}

/**
 * Busca los workspaces del monorepo que declaran su topología de Pub/Sub.
 *
 * Lee `workspaces` del `package.json` de la raíz (una lista, o `{packages}`), expande los patrones y devuelve los
 * workspaces que tienen un `mrpack.pubsub.ts` en su raíz. Incluye todos, estén habilitados o no en
 * `config.workspaces.json`: la topología es del repo, no de lo que la persona tenga encendido.
 *
 * Los patrones que empiezan por `!` excluyen. Un directorio solo cuenta como workspace si tiene `package.json`.
 *
 * @param raiz - Raíz del monorepo.
 * @returns Rutas de los workspaces relativas a la raíz (`services/amateur`), por orden alfabético.
 * @throws {Error} Si no se puede leer el `package.json` de la raíz o su `workspaces` no tiene forma de lista de patrones.
 */
export async function buscarDeclaraciones(raiz: string): Promise<string[]> {
    const ficheroManifiesto = path.join(raiz, "package.json");
    const manifiesto: unknown = JSON.parse(await readFile(ficheroManifiesto, "utf8"));
    const patrones = leerPatrones(manifiesto, ficheroManifiesto);

    const incluidos = new Set<string>();
    const excluidos = new Set<string>();
    for (const patron of patrones) {
        const negativo = patron.startsWith("!");
        for (const workspace of await expandir(raiz, negativo ? patron.slice(1) : patron)) {
            (negativo ? excluidos : incluidos).add(workspace);
        }
    }

    const declarados: string[] = [];
    for (const workspace of [...incluidos].filter((candidato) => !excluidos.has(candidato))) {
        if (await esFichero(path.join(raiz, workspace, "package.json")) && await esFichero(path.join(raiz, workspace, FICHERO_DECLARACION))) {
            declarados.push(workspace);
        }
    }
    return declarados.sort();
}
