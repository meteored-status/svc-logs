import {jsdocDe, nodoDocumentado, rangoDeLineaCompleta} from "../lib/utilidades.js";

const NODOS_CON_RETORNO = [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "TSDeclareFunction",
    "TSEmptyBodyFunctionExpression",
    "TSMethodSignature",
];

/** Detecta la línea que abre una etiqueta JSDoc cualquiera (`@param`, `@returns`, `@throws`…). */
const LINEA_DE_ETIQUETA = /^\s*\*?\s*@\w+/;

/** Detecta la línea que abre la etiqueta de retorno, en sus dos grafías. */
const LINEA_DE_RETORNO = /^\s*\*?\s*@returns?\b/;

/** Línea sin contenido propio: vacía o con solo el asterisco de continuación. */
const LINEA_VACIA = /^\s*\*?\s*$/;

/**
 * Si el tipo de retorno declarado es `void` o `Promise<void>`.
 *
 * @param {object|undefined} anotacion - Nodo `returnType` del nodo función.
 * @returns `true` si la función no devuelve ningún valor significativo.
 */
function devuelveVoid(anotacion) {
    const tipo = anotacion?.typeAnnotation;
    if (!tipo) {
        return false;
    }
    if (tipo.type === "TSVoidKeyword") {
        return true;
    }
    if (tipo.type !== "TSTypeReference" || tipo.typeName.type !== "Identifier" || tipo.typeName.name !== "Promise") {
        return false;
    }
    const argumentos = tipo.typeArguments ?? tipo.typeParameters;
    return argumentos?.params?.length === 1 && argumentos.params[0].type === "TSVoidKeyword";
}

/**
 * Quita del JSDoc el bloque de la etiqueta de retorno: su línea y las de continuación que la
 * siguen, hasta la etiqueta siguiente. La última línea del comentario (la del cierre) nunca se
 * consume, o el resultado dejaría de ser un comentario válido.
 *
 * @param {string[]} lineas - Líneas del contenido del comentario.
 * @param {number}   indice - Posición de la línea que abre la etiqueta.
 * @returns Las líneas restantes.
 */
function quitarEtiquetaDeRetorno(lineas, indice) {
    const tope = lineas.length > 1 ? lineas.length - 1 : lineas.length;
    let fin = indice + 1;
    while (fin < tope && !LINEA_DE_ETIQUETA.test(lineas[fin])) {
        fin += 1;
    }
    const restantes = [...lineas.slice(0, indice), ...lineas.slice(fin)];
    // Las líneas de separación que quedasen justo antes del cierre ya no separan nada.
    let ultima = restantes.length - 2;
    while (ultima >= 0 && LINEA_VACIA.test(restantes[ultima])) {
        restantes.splice(ultima, 1);
        ultima -= 1;
    }
    return restantes;
}

/**
 * Regla `mrpack/no-returns-on-void`.
 *
 * Convención: «no es necesario documentar el valor de retorno en funciones o métodos cuyo tipo de
 * retorno sea `Promise<void>` (o `void`), ya que se entiende que no devuelven ningún valor
 * significativo. Omitir la etiqueta `@returns` en esos casos».
 *
 * Sí es autocorregible, a diferencia de las demás reglas de documentación: aquí no hay que
 * reescribir nada, solo borrar una etiqueta que sobra entera.
 */
export default {
    meta: {
        type: "suggestion",
        docs: {
            description: "Prohíbe documentar `@returns` en funciones cuyo tipo de retorno es `void` o `Promise<void>`.",
        },
        fixable: "code",
        schema: [],
        messages: {
            returnsInnecesario: "`@returns` sobra: esta función devuelve `{{retorno}}`.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        /**
         * Comprueba la documentación de un nodo función.
         *
         * @param {object} nodo - Nodo con `returnType`.
         */
        function comprobar(nodo) {
            if (!devuelveVoid(nodo.returnType)) {
                return;
            }
            const jsdoc = jsdocDe(sourceCode, nodoDocumentado(nodo));
            if (!jsdoc) {
                return;
            }
            const lineas = jsdoc.value.split("\n");
            const indice = lineas.findIndex((linea) => LINEA_DE_RETORNO.test(linea));
            if (indice === -1) {
                return;
            }
            const desplazamiento = lineas.slice(0, indice).reduce((suma, linea) => suma + linea.length + 1, 0);
            const posicion = jsdoc.range[0] + 2 + desplazamiento + lineas[indice].indexOf("@");
            context.report({
                loc: {
                    start: sourceCode.getLocFromIndex(posicion),
                    end: sourceCode.getLocFromIndex(posicion + lineas[indice].trim().length),
                },
                messageId: "returnsInnecesario",
                data: {retorno: sourceCode.getText(nodo.returnType.typeAnnotation)},
                fix(fixer) {
                    const restantes = quitarEtiquetaDeRetorno(lineas, indice);
                    const contenido = restantes.join("\n");
                    if (LINEA_VACIA.test(contenido.replace(/\n/g, ""))) {
                        return fixer.removeRange(rangoDeLineaCompleta(sourceCode, jsdoc));
                    }
                    return fixer.replaceTextRange(jsdoc.range, `/*${contenido}*/`);
                },
            });
        }

        return Object.fromEntries(NODOS_CON_RETORNO.map((tipo) => [tipo, comprobar]));
    },
};
