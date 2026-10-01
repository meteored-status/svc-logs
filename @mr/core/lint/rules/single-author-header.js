import {rangoDeLineaCompleta} from "../lib/utilidades.js";

/** Líneas que hacen de un comentario un bloque de autoría: sin las dos, no lo es. */
const LINEA_EDITOR = /^\s*\*\s*Editor: /m;
const LINEA_FECHA = /^\s*\*\s*Fecha: /m;

/**
 * Si un comentario de bloque es una cabecera de autoría de `mrpack framework --send`.
 *
 * @param {object} comentario - Comentario de ESLint.
 * @returns `true` si es un `/** … *\/` con las líneas `Editor:` y `Fecha:`.
 */
function esCabeceraDeBloque(comentario) {
    return comentario.type === "Block"
        && comentario.value.startsWith("*")
        && LINEA_EDITOR.test(comentario.value)
        && LINEA_FECHA.test(comentario.value);
}

/**
 * Cabeceras de autoría comentadas con `//` línea a línea, que es como quedan cuando se comenta un
 * fichero entero con el IDE: `// /**`, `//  * Editor: …`, …, `//  *\/`. Se buscan dentro de las
 * rachas de comentarios de línea consecutivos.
 *
 * @param {object[]} comentarios - Todos los comentarios del fichero, en orden.
 * @returns Pares `[primero, ultimo]` de comentarios de línea que delimitan cada cabecera.
 */
function cabecerasComentadas(comentarios) {
    const encontradas = [];
    let inicio;
    for (let indice = 0; indice < comentarios.length; indice += 1) {
        const actual = comentarios[indice];
        const anterior = comentarios[indice - 1];
        const seguido = anterior?.type === "Line" && actual.type === "Line" && actual.loc.start.line === anterior.loc.end.line + 1;
        if (!seguido) {
            inicio = undefined;
        }
        if (actual.type !== "Line") {
            continue;
        }
        const texto = actual.value.trim();
        if (texto === "/**") {
            inicio = indice;
            continue;
        }
        if (inicio === undefined) {
            continue;
        }
        if (texto === "*/") {
            const cuerpo = comentarios.slice(inicio + 1, indice).map((c) => c.value).join("\n");
            if (LINEA_EDITOR.test(cuerpo) && LINEA_FECHA.test(cuerpo)) {
                encontradas.push([comentarios[inicio], actual]);
            }
            inicio = undefined;
        } else if (!texto.startsWith("*")) {
            inicio = undefined;
        }
    }
    return encontradas;
}

/**
 * Regla `mrpack/single-author-header`.
 *
 * `mrpack framework --send` escribe una cabecera de autoría (`Editor`, `Fecha`, `Hash`, `Versión`…) al
 * principio de cada fichero `.ts` que envía, y antes quita las que haya **al principio**
 * (`stripAutoria()`, en `@mr/cli/src/clases/paquete/file.ts`). Cualquier otra que quede en el fichero
 * —una que dejó de estar en la primera línea, o la de un fichero comentado entero— ya no la toca
 * nadie: se queda para siempre, y con información que no es verdad.
 *
 * La buena es la primera, y solo si está al principio del fichero: es la que regenera el envío.
 * Todas las demás sobran, y se borran enteras con su línea en blanco. Si no hay ninguna al principio,
 * sobran todas: el siguiente envío pondrá la suya.
 */
export default {
    meta: {
        type: "suggestion",
        docs: {
            description: "Deja una sola cabecera de autoría, la del principio del fichero, y elimina las demás.",
        },
        fixable: "code",
        schema: [],
        messages: {
            cabeceraDuplicada: "Bloque de autoría duplicado: el bueno es el del principio del fichero, que es el que regenera `mrpack framework --send`.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        /**
         * Rango de una cabecera comentada con `//`: sus líneas enteras y, si la siguiente es una línea
         * en blanco o un `//` vacío, también esa, para no dejar un hueco.
         *
         * @param {object} primero - Comentario `// /**`.
         * @param {object} ultimo  - Comentario `//  *\/`.
         * @returns Rango `[inicio, fin]`.
         */
        function rangoComentado(primero, ultimo) {
            const texto = sourceCode.getText();
            let inicio = primero.range[0];
            while (inicio > 0 && texto[inicio - 1] !== "\n") {
                inicio -= 1;
            }
            let fin = texto.indexOf("\n", ultimo.range[1]);
            fin = fin === -1 ? texto.length : fin + 1;
            const siguiente = texto.indexOf("\n", fin);
            const linea = texto.slice(fin, siguiente === -1 ? texto.length : siguiente).trim();
            if (siguiente !== -1 && (linea === "" || linea === "//")) {
                fin = siguiente + 1;
            }
            return [inicio, fin];
        }

        return {
            Program() {
                const comentarios = sourceCode.getAllComments();
                const primero = comentarios[0];
                const antesDelPrimero = primero ? sourceCode.getText().slice(0, primero.range[0]).replace(/^﻿/, "") : "";
                const legitima = primero && esCabeceraDeBloque(primero) && antesDelPrimero.trim() === "" ? primero : undefined;

                for (const comentario of comentarios) {
                    if (comentario === legitima || !esCabeceraDeBloque(comentario)) {
                        continue;
                    }
                    context.report({
                        loc: comentario.loc,
                        messageId: "cabeceraDuplicada",
                        fix: (fixer) => fixer.removeRange(rangoDeLineaCompleta(sourceCode, comentario)),
                    });
                }
                for (const [inicio, fin] of cabecerasComentadas(comentarios)) {
                    context.report({
                        loc: {start: inicio.loc.start, end: fin.loc.end},
                        messageId: "cabeceraDuplicada",
                        fix: (fixer) => fixer.removeRange(rangoComentado(inicio, fin)),
                    });
                }
            },
        };
    },
};
