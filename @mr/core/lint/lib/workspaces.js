import fs from "node:fs";
import path from "node:path";

/**
 * Nombres de workspace ya calculados, por raíz de monorepo. La lista la pide `import-blocks` una
 * vez por fichero y no cambia en toda la pasada, así que se lee el disco una vez por raíz.
 */
const nombresPorRaiz = new Map();

/**
 * Raíz del monorepo ya encontrada, por directorio de partida.
 */
const raicesPorDirectorio = new Map();

/**
 * Lee un `package.json` sin que un fichero roto o ausente tumbe el linter: aquí solo interesa si
 * declara algo, y la respuesta ante la duda es que no.
 *
 * @param {string} fichero - Ruta del `package.json`.
 * @returns El contenido, o `undefined`.
 */
function leerPaquete(fichero) {
    try {
        return JSON.parse(fs.readFileSync(fichero, "utf8"));
    } catch {
        return undefined;
    }
}

/**
 * Raíz del monorepo: el primer directorio, subiendo desde `directorio`, cuyo `package.json` declara
 * `workspaces`. No vale el `package.json` más cercano, que es el del propio workspace.
 *
 * @param {string} directorio - Punto de partida.
 * @returns La ruta de la raíz, o `undefined` si el fichero no está dentro de ningún monorepo.
 */
export function raizDelMonorepo(directorio) {
    if (raicesPorDirectorio.has(directorio)) {
        return raicesPorDirectorio.get(directorio);
    }
    let actual = directorio;
    let raiz;
    for (;;) {
        if (Array.isArray(leerPaquete(path.join(actual, "package.json"))?.workspaces)) {
            raiz = actual;
            break;
        }
        const padre = path.dirname(actual);
        if (padre === actual) {
            break;
        }
        actual = padre;
    }
    raicesPorDirectorio.set(directorio, raiz);
    return raiz;
}

/**
 * Directorios que cubre un patrón de `workspaces`. Solo se entienden las dos formas que usa el
 * `package.json` raíz que escribe `mrpack init`: una ruta literal (`i18n`) y una carpeta con
 * comodín final (`services/*`). Un patrón con otra forma se ignora en lugar de adivinarlo: el
 * efecto es que sus paquetes caen en el bloque de dependencias públicas, que se ve en el primer
 * fichero que los importe.
 *
 * @param {string} raiz   - Raíz del monorepo.
 * @param {string} patron - Entrada de `workspaces`.
 * @returns Directorios candidatos, existan o no con `package.json`.
 */
function expandir(raiz, patron) {
    if (!patron.includes("*")) {
        return [path.join(raiz, patron)];
    }
    if (!patron.endsWith("/*") || patron.slice(0, -2).includes("*")) {
        return [];
    }
    const base = path.join(raiz, patron.slice(0, -2));
    try {
        return fs.readdirSync(base).map((entrada) => path.join(base, entrada));
    } catch {
        return [];
    }
}

/**
 * Nombres de paquete de todos los workspaces del monorepo, leídos de los `package.json` que cubren
 * los patrones de `workspaces` de la raíz.
 *
 * Existe porque la lista **no se puede escribir en la configuración**: cada monorepo consumidor
 * del framework tiene la suya, y una lista copiada se queda vieja en cuanto alguien añade un
 * servicio.
 *
 * @param {string} raiz - Raíz del monorepo.
 * @returns Los nombres, sin repetir.
 */
export function workspacesDe(raiz) {
    if (nombresPorRaiz.has(raiz)) {
        return nombresPorRaiz.get(raiz);
    }
    const nombres = new Set();
    for (const patron of leerPaquete(path.join(raiz, "package.json"))?.workspaces ?? []) {
        for (const directorio of expandir(raiz, patron)) {
            const nombre = leerPaquete(path.join(directorio, "package.json"))?.name;
            if (typeof nombre === "string") {
                nombres.add(nombre);
            }
        }
    }
    const lista = [...nombres];
    nombresPorRaiz.set(raiz, lista);
    return lista;
}
