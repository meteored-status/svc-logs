import path from "node:path";

import {comentariosPropios} from "../lib/utilidades.js";
import {raizDelMonorepo, workspacesDe} from "../lib/workspaces.js";

/**
 * Los tres bloques de la convención, en el orden en el que tienen que aparecer.
 *
 * - `1` — dependencias públicas y de Node.js (`node:*`, paquetes de npm).
 * - `2` — otros workspaces del monorepo, importados por nombre de paquete.
 * - `3` — el propio workspace, por ruta relativa.
 */
const BLOQUE_PUBLICO = 1;
const BLOQUE_WORKSPACE = 2;
const BLOQUE_LOCAL = 3;

const NOMBRE_DE_BLOQUE = {
    [BLOQUE_PUBLICO]: "dependencias públicas y de Node.js",
    [BLOQUE_WORKSPACE]: "otros workspaces del monorepo",
    [BLOQUE_LOCAL]: "el propio workspace",
};

/**
 * Prefijos de los alias de ruta del `tsconfig` (`paths`) que se usan en los proyectos Next.js para el
 * propio workspace: `@/components/…`, `~/lib/…`. Son el bloque 3 aunque no empiecen por `.`, y sin
 * esto caían en el de dependencias públicas. No se leen los `paths` de cada `tsconfig`: estos dos son
 * los que hay, y un nombre de paquete de npm no puede empezar por ninguno de los dos.
 */
const ALIAS_LOCALES = ["@/", "~/"];

/**
 * A qué bloque pertenece un import según su especificador.
 *
 * @param {string}   fuente     - Módulo importado, tal cual aparece entre comillas.
 * @param {string[]} workspaces - Nombres de paquete de los demás workspaces del monorepo.
 * @returns El número de bloque.
 */
function bloqueDe(fuente, workspaces) {
    if (fuente.startsWith(".") || ALIAS_LOCALES.some((alias) => fuente.startsWith(alias))) {
        return BLOQUE_LOCAL;
    }
    if (workspaces.some((nombre) => fuente === nombre || fuente.startsWith(`${nombre}/`))) {
        return BLOQUE_WORKSPACE;
    }
    return BLOQUE_PUBLICO;
}

/**
 * Workspaces del monorepo al que pertenece el fichero que se está revisando. Es el valor por
 * defecto de la opción `workspaces`: la lista se deduce del `package.json` raíz en vez de copiarse
 * en la configuración, porque cada monorepo que consume el framework tiene la suya.
 *
 * @param {string} fichero - `context.filename`.
 * @returns Los nombres de paquete, o ninguno si el fichero no está en un monorepo (un fragmento de
 *          test, por ejemplo).
 */
function workspacesDelFichero(fichero) {
    if (!fichero || !path.isAbsolute(fichero)) {
        return [];
    }
    const raiz = raizDelMonorepo(path.dirname(fichero));
    return raiz ? workspacesDe(raiz) : [];
}

/**
 * Clasifica un import por su forma: los destructurados van antes que los import por defecto dentro
 * de cada bloque, y los de efecto lateral (`import "./x.scss"`) quedan fuera de esa ordenación.
 *
 * @param {object} nodo - `ImportDeclaration`.
 * @returns `"efecto"`, `"destructurado"` o `"defecto"`.
 */
function formaDe(nodo) {
    if (nodo.specifiers.length === 0) {
        return "efecto";
    }
    return nodo.specifiers.some((specifier) => specifier.type === "ImportSpecifier") ? "destructurado" : "defecto";
}

/**
 * Clave de ordenación alfabética: el primer símbolo importado en los destructurados (que es lo que
 * se lee primero en la línea) y el nombre del módulo en los import por defecto.
 *
 * @param {object} nodo - `ImportDeclaration`.
 * @returns La clave, en minúsculas para comparar sin distinguir mayúsculas.
 */
function claveDeOrden(nodo) {
    const destructurado = nodo.specifiers.find((specifier) => specifier.type === "ImportSpecifier");
    const clave = destructurado ? (destructurado.imported.name ?? destructurado.local.name) : nodo.source.value;
    return clave.toLowerCase();
}

/**
 * Regla `mrpack/import-blocks`.
 *
 * Convención: «los imports se organizan en tres bloques separados por una línea en blanco», con
 * los destructurados antes que los import por defecto dentro de cada bloque, y cada grupo ordenado
 * alfabéticamente.
 *
 * La ordenación alfabética viene **desactivada** por defecto (`alfabetico`): es la parte de la
 * convención que el código existente no cumple de forma sistemática, y encenderla de golpe
 * convertiría casi cada fichero en un error. Los bloques y su separación, en cambio, sí se cumplen
 * hoy, así que van activados.
 *
 * Solo se autocorrigen las líneas en blanco entre imports, y únicamente cuando no hay comentarios
 * por medio que puedan quedar descolocados. Reordenar imports no se corrige nunca: un import puede
 * tener efectos laterales y cambiarlo de sitio cambia el orden en que se ejecutan.
 */
export default {
    meta: {
        type: "layout",
        docs: {
            description: "Organiza los imports en los tres bloques de la convención, separados por una línea en blanco.",
        },
        fixable: "whitespace",
        schema: [{
            type: "object",
            properties: {
                workspaces: {type: "array", items: {type: "string"}},
                alfabetico: {type: "boolean"},
                ordenPorForma: {type: "boolean"},
            },
            additionalProperties: false,
        }],
        messages: {
            bloqueDesordenado: "Este import es de {{actual}} y va después de uno de {{anterior}}: los bloques van en orden.",
            faltaSeparacion: "Separa con una línea en blanco el bloque de {{anterior}} del de {{actual}}.",
            sobraSeparacion: "Los imports del mismo bloque van seguidos, sin líneas en blanco entre ellos.",
            separacionDeMas: "Entre dos bloques de imports va exactamente una línea en blanco.",
            defectoAntesDeDestructurado: "Dentro de un bloque, los imports destructurados van antes que los import por defecto.",
            desordenAlfabetico: "`{{actual}}` va alfabéticamente antes que `{{anterior}}`.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const opciones = context.options[0] ?? {};
        const workspaces = opciones.workspaces ?? workspacesDelFichero(context.filename);
        const alfabetico = opciones.alfabetico ?? false;
        const ordenPorForma = opciones.ordenPorForma ?? true;

        /**
         * Punto por el que empieza «visualmente» un import: su primer comentario adjunto, si lo
         * tiene, o el propio nodo. Es lo que hay que mirar para contar las líneas en blanco que lo
         * separan del import anterior.
         *
         * @param {object} nodo - `ImportDeclaration`.
         * @returns El comentario o el nodo.
         */
        function inicioDe(nodo) {
            const previos = comentariosPropios(sourceCode, nodo);
            return previos.length > 0 ? previos[0] : nodo;
        }

        /**
         * Si entre dos imports no hay más que espacio en blanco, que es la única condición en la que
         * se puede autocorregir la separación: el arreglo reemplaza ese hueco entero por saltos de
         * línea, así que **cualquier cosa que hubiera ahí se perdería**.
         *
         * No es solo por los comentarios. Un `"use client";` mal colocado entre dos imports también
         * cae ahí, y borrarlo convierte un componente de cliente en uno de servidor: el proyecto
         * compila, y falla al prerenderizar con un error que señala al primer hook que se encuentre.
         *
         * @param {object} anterior - `ImportDeclaration` de arriba.
         * @param {object} actual   - `ImportDeclaration` de abajo.
         * @returns `true` si el hueco entre los dos está vacío.
         */
        function soloHayEspacio(anterior, actual) {
            return sourceCode.getText().slice(anterior.range[1], actual.range[0]).trim() === "";
        }

        return {
            Program(programa) {
                const imports = programa.body.filter((nodo) => nodo.type === "ImportDeclaration");
                for (let indice = 1; indice < imports.length; indice += 1) {
                    const anterior = imports[indice - 1];
                    const actual = imports[indice];
                    const bloqueAnterior = bloqueDe(anterior.source.value, workspaces);
                    const bloqueActual = bloqueDe(actual.source.value, workspaces);

                    if (bloqueActual < bloqueAnterior) {
                        context.report({
                            node: actual,
                            messageId: "bloqueDesordenado",
                            data: {actual: NOMBRE_DE_BLOQUE[bloqueActual], anterior: NOMBRE_DE_BLOQUE[bloqueAnterior]},
                        });
                        continue;
                    }

                    // Con código entre los dos imports (el `sourceMapSupport.install();` de los `main.ts`),
                    // las líneas en blanco no separan dos imports sino un import de una sentencia, y
                    // contarlas obligaría a pegar el código al import para cuadrar la cuenta.
                    const hayCodigoEntre = sourceCode.getTokensBetween(anterior, actual).length > 0;
                    const inicio = inicioDe(actual);
                    const enBlanco = inicio.loc.start.line - anterior.loc.end.line - 1;
                    const esperadas = bloqueActual === bloqueAnterior ? 0 : 1;
                    if (!hayCodigoEntre && enBlanco !== esperadas) {
                        const sePuedeArreglar = soloHayEspacio(anterior, actual);
                        let messageId = "sobraSeparacion";
                        if (enBlanco < esperadas) {
                            messageId = "faltaSeparacion";
                        } else if (esperadas === 1) {
                            messageId = "separacionDeMas";
                        }
                        context.report({
                            node: actual,
                            messageId,
                            data: {anterior: NOMBRE_DE_BLOQUE[bloqueAnterior], actual: NOMBRE_DE_BLOQUE[bloqueActual]},
                            fix: sePuedeArreglar
                                ? (fixer) => fixer.replaceTextRange([anterior.range[1], actual.range[0]], "\n".repeat(esperadas + 1))
                                : undefined,
                        });
                    }

                    if (bloqueActual !== bloqueAnterior) {
                        continue;
                    }
                    const formaAnterior = formaDe(anterior);
                    const formaActual = formaDe(actual);
                    if (formaAnterior === "efecto" || formaActual === "efecto") {
                        continue;
                    }
                    if (ordenPorForma && formaAnterior === "defecto" && formaActual === "destructurado") {
                        context.report({node: actual, messageId: "defectoAntesDeDestructurado"});
                        continue;
                    }
                    if (alfabetico && formaAnterior === formaActual && claveDeOrden(actual) < claveDeOrden(anterior)) {
                        context.report({
                            node: actual,
                            messageId: "desordenAlfabetico",
                            data: {actual: claveDeOrden(actual), anterior: claveDeOrden(anterior)},
                        });
                    }
                }
            },
        };
    },
};
