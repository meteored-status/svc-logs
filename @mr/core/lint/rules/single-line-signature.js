/**
 * Nodos con lista de parámetros que la regla examina. Se incluyen los tipos de función
 * (`TSMethodSignature`, `TSFunctionType`) porque la firma de un callback declarado en una interfaz
 * se lee igual de mal partida en varias líneas que la de su implementación.
 */
const NODOS_CON_PARAMETROS = [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "TSDeclareFunction",
    "TSEmptyBodyFunctionExpression",
    "TSMethodSignature",
    "TSFunctionType",
    "TSConstructSignatureDeclaration",
    "TSCallSignatureDeclaration",
];

/**
 * Regla `mrpack/single-line-signature`.
 *
 * Convención: «todos los parámetros en la definición deben ir en una sola línea (sin saltos de
 * línea dentro de `(...)`)».
 *
 * Se comprueba el paréntesis de apertura y el de cierre de la lista de parámetros, no los
 * parámetros entre sí: así también salta un `(\n    a: string\n)` de un solo parámetro, que es
 * exactamente el caso que la convención quiere evitar.
 *
 * No es autocorregible: juntar las líneas puede dejar una firma desmedida —y la convención tiene
 * una salida prevista para eso, agrupar en un objeto de configuración (ver
 * `mrpack/config-object-params`)— y, con comentarios entre los parámetros, unir las líneas
 * los comería.
 */
export default {
    meta: {
        type: "layout",
        docs: {
            description: "Exige que la lista de parámetros de una firma quepa en una sola línea.",
        },
        schema: [],
        messages: {
            unaSolaLinea: "Los parámetros de la firma deben ir todos en una sola línea.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        /**
         * Comprueba la lista de parámetros de un nodo función.
         *
         * @param {object} nodo - Nodo con `params`.
         */
        function comprobar(nodo) {
            if (nodo.params.length === 0) {
                return;
            }
            const primero = nodo.params[0];
            const abre = sourceCode.getTokenBefore(primero);
            // Una flecha de un solo parámetro sin paréntesis (`x => x + 1`) no tiene lista que
            // comprobar. No basta con mirar que el token anterior sea un `(`: si la flecha es el
            // argumento de una llamada (`docs.map(doc => {…})`), ese `(` es **el de la llamada**, y el `)`
            // que se encuentra después es el que la cierra, varias líneas más abajo. Por eso se exige
            // además que el paréntesis esté dentro de la propia función. Sin eso, cada callback de
            // varias líneas pasado a un `map`/`forEach`/`then` salía como una firma partida.
            if (!abre || abre.value !== "(" || abre.range[0] < nodo.range[0]) {
                return;
            }
            let cierra = sourceCode.getTokenAfter(nodo.params[nodo.params.length - 1]);
            while (cierra && cierra.value !== ")") {
                cierra = sourceCode.getTokenAfter(cierra);
            }
            if (!cierra || abre.loc.start.line === cierra.loc.end.line) {
                return;
            }
            context.report({
                loc: {start: abre.loc.start, end: cierra.loc.end},
                messageId: "unaSolaLinea",
            });
        }

        return Object.fromEntries(NODOS_CON_PARAMETROS.map((tipo) => [tipo, comprobar]));
    },
};
