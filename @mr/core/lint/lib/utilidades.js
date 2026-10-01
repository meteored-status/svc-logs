/**
 * Utilidades compartidas por varias reglas del plugin. Todas trabajan sobre el `SourceCode` de
 * ESLint y no guardan estado, así que se pueden llamar desde cualquier punto de un `create()`.
 */

/**
 * Tipos de nodo que envuelven a una función sin ser ellos mismos la función, y que son los que
 * llevan el bloque JSDoc delante. Se usan para subir desde una `FunctionExpression` hasta el nodo
 * que de verdad está documentado: en `export async function f()` el JSDoc cuelga del
 * `ExportNamedDeclaration`, no de la `FunctionDeclaration`, y en un método de clase cuelga del
 * `MethodDefinition`, no de su `value`.
 */
const ENVOLTORIOS_DOCUMENTABLES = new Set([
    "MethodDefinition",
    "TSAbstractMethodDefinition",
    "PropertyDefinition",
    "AccessorProperty",
    "Property",
    "VariableDeclarator",
    "VariableDeclaration",
    "ExportNamedDeclaration",
    "ExportDefaultDeclaration",
]);

/**
 * Sube desde un nodo función hasta el nodo al que se le pone el JSDoc.
 *
 * @param {object} nodo - Nodo función (`FunctionDeclaration`, `FunctionExpression`, …).
 * @returns El ancestro más externo que sigue describiendo a la misma función.
 */
export function nodoDocumentado(nodo) {
    let actual = nodo;
    while (actual.parent && ENVOLTORIOS_DOCUMENTABLES.has(actual.parent.type)) {
        actual = actual.parent;
    }
    return actual;
}

/**
 * Último bloque JSDoc que precede a un nodo, si lo hay. Se coge el último y no el primero porque
 * entre varios comentarios seguidos el que documenta al nodo es siempre el más pegado a él.
 *
 * @param {object} sourceCode - `SourceCode` de ESLint.
 * @param {object} nodo       - Nodo cuyo JSDoc se busca.
 * @returns El comentario JSDoc, o `undefined` si el nodo no está documentado.
 */
export function jsdocDe(sourceCode, nodo) {
    const previos = sourceCode.getCommentsBefore(nodo);
    for (let indice = previos.length - 1; indice >= 0; indice -= 1) {
        const comentario = previos[indice];
        if (comentario.type === "Block" && comentario.value.startsWith("*")) {
            return comentario;
        }
    }
    return undefined;
}

/**
 * Rango que hay que borrar para llevarse un comentario **y la línea que ocupa**, incluida la línea
 * en blanco que venga justo detrás. Si el comentario comparte línea con código, el rango se limita
 * al propio comentario para no arrastrar nada más.
 *
 * @param {object} sourceCode  - `SourceCode` de ESLint.
 * @param {object} comentario  - Comentario a borrar.
 * @returns Rango `[inicio, fin]` listo para `fixer.removeRange()`.
 */
export function rangoDeLineaCompleta(sourceCode, comentario) {
    const texto = sourceCode.getText();
    let inicio = comentario.range[0];
    while (inicio > 0 && texto[inicio - 1] !== "\n") {
        inicio -= 1;
    }
    if (texto.slice(inicio, comentario.range[0]).trim() !== "") {
        return comentario.range;
    }
    let fin = comentario.range[1];
    while (fin < texto.length && texto[fin] !== "\n") {
        fin += 1;
    }
    if (texto.slice(comentario.range[1], fin).trim() !== "") {
        return comentario.range;
    }
    fin += 1;
    const siguienteSalto = texto.indexOf("\n", fin);
    const finLineaSiguiente = siguienteSalto === -1 ? texto.length : siguienteSalto + 1;
    if (texto.slice(fin, finLineaSiguiente).trim() === "" && finLineaSiguiente > fin) {
        fin = finLineaSiguiente;
    }
    return [inicio, fin];
}

/**
 * Comentarios que preceden a un nodo **y son suyos**: los de `getCommentsBefore()` menos el que va
 * al final de la línea anterior (`const a = 1; // nota`), que es del código de esa línea aunque
 * ESLint lo cuente como anterior al nodo siguiente.
 *
 * Sin este filtro, insertar «antes del primer comentario» metía el texto en mitad de la línea
 * anterior: `class-section-comments` dejó un `/* INSTANCE *\/` detrás de un `= 64 * 1024;` y el
 * `// 64 KB` suelto dos líneas más abajo.
 *
 * @param {object} sourceCode - `SourceCode` de ESLint.
 * @param {object} nodo       - Nodo cuyos comentarios se buscan.
 * @returns Los comentarios, en orden.
 */
export function comentariosPropios(sourceCode, nodo) {
    return sourceCode.getCommentsBefore(nodo).filter((comentario) => {
        const anterior = sourceCode.getTokenBefore(comentario);
        return !anterior || anterior.loc.end.line !== comentario.loc.start.line;
    });
}

/**
 * Primer comentario de los que preceden a un nodo sin código por medio, o el propio nodo si no
 * tiene ninguno. Es el punto por el que hay que insertar texto para que quede **por encima** del
 * JSDoc del miembro y no incrustado entre el JSDoc y lo que documenta.
 *
 * @param {object} sourceCode - `SourceCode` de ESLint.
 * @param {object} nodo       - Nodo ante el que se va a insertar.
 * @returns El comentario más alto, o el nodo.
 */
export function anclaDeInsercion(sourceCode, nodo) {
    const previos = comentariosPropios(sourceCode, nodo);
    return previos.length > 0 ? previos[0] : nodo;
}

/**
 * Texto fuente de la clave de un miembro (`nombre`, `"con espacios"`, `[calculada]`…), para poder
 * nombrarlo en el mensaje de error.
 *
 * @param {object} sourceCode - `SourceCode` de ESLint.
 * @param {object} clave      - Nodo `key` del miembro.
 * @returns El nombre tal cual aparece en el código.
 */
export function nombreDeClave(sourceCode, clave) {
    return sourceCode.getText(clave);
}
