import fs from "node:fs";
import path from "node:path";

/**
 * Raíz de workspace ya calculada para cada directorio. El linter recorre muchos ficheros del mismo
 * directorio y la respuesta no cambia entre ellos, así que la búsqueda de `package.json` se hace
 * una vez por directorio y no una vez por fichero.
 */
const raicesPorDirectorio = new Map();

/**
 * Directorio del `package.json` más cercano subiendo desde `directorio`.
 *
 * @param {string} directorio - Punto de partida.
 * @returns La ruta del workspace, o `undefined` si no hay ningún `package.json` por encima.
 */
function raizDelWorkspace(directorio) {
    if (raicesPorDirectorio.has(directorio)) {
        return raicesPorDirectorio.get(directorio);
    }
    let actual = directorio;
    let raiz;
    for (;;) {
        if (fs.existsSync(path.join(actual, "package.json"))) {
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
 * Regla `mrpack/no-cross-workspace-relative-import`.
 *
 * Convención: «usar siempre el nombre de paquete del workspace, nunca rutas relativas entre
 * paquetes».
 *
 * Se considera que una ruta relativa cruza de workspace cuando, resuelta, cae fuera del directorio
 * del `package.json` más cercano al fichero que la escribe. Hoy el monorepo tiene un solo workspace
 * y la regla no puede saltar, pero es justo la que evita que el primer `../../otro-servicio` entre
 * sin que nadie lo vea.
 */
export default {
    meta: {
        type: "problem",
        docs: {
            description: "Prohíbe importar otro workspace por ruta relativa en vez de por nombre de paquete.",
        },
        schema: [],
        messages: {
            usaNombreDePaquete: "`{{fuente}}` sale del workspace `{{workspace}}`: importa el otro paquete por su nombre.",
        },
    },
    create(context) {
        const fichero = context.filename;
        if (!fichero || !path.isAbsolute(fichero)) {
            return {};
        }
        const raiz = raizDelWorkspace(path.dirname(fichero));
        if (!raiz) {
            return {};
        }
        return {
            ImportDeclaration(nodo) {
                const fuente = nodo.source.value;
                if (typeof fuente !== "string" || !fuente.startsWith(".")) {
                    return;
                }
                const resuelta = path.resolve(path.dirname(fichero), fuente);
                if (resuelta === raiz || resuelta.startsWith(raiz + path.sep)) {
                    return;
                }
                context.report({
                    node: nodo.source,
                    messageId: "usaNombreDePaquete",
                    data: {fuente, workspace: path.basename(raiz)},
                });
            },
        };
    },
};
