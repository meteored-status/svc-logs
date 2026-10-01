/**
 * Regla `mrpack/jsdoc-type-members`.
 *
 * Convención: «la documentación de las propiedades/miembros se escribe en el bloque JSDoc del
 * propio tipo, no como comentarios inline en cada declaración. Esto reduce el ruido visual dentro
 * del cuerpo del tipo».
 *
 * Por defecto solo salta con bloques JSDoc dentro del cuerpo, que son inequívocamente
 * documentación. Los comentarios de línea quedan fuera salvo que se pida `incluirComentariosDeLinea`:
 * dentro de un cuerpo también aparecen notas que no documentan nada (`// eslint-disable-next-line`,
 * un recordatorio suelto) y convertirlas en error obligaría a excepciones por todas partes.
 *
 * No es autocorregible: llevar la prosa al bloque del tipo con su `@property` es reescribir texto,
 * no mover caracteres, y hacerlo a ciegas produciría documentación peor que la que quita.
 */
export default {
    meta: {
        type: "suggestion",
        docs: {
            description: "Exige documentar los miembros de interfaces y enums en el bloque JSDoc del tipo, no dentro del cuerpo.",
        },
        schema: [{
            type: "object",
            properties: {
                incluirComentariosDeLinea: {type: "boolean"},
                incluirTiposLiterales: {type: "boolean"},
            },
            additionalProperties: false,
        }],
        messages: {
            documentaEnElBloque: "Documenta `{{miembro}}` con `@property` en el bloque JSDoc de `{{tipo}}`, no con un comentario dentro del cuerpo.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const opciones = context.options[0] ?? {};
        const incluirComentariosDeLinea = opciones.incluirComentariosDeLinea ?? false;
        const incluirTiposLiterales = opciones.incluirTiposLiterales ?? false;

        /**
         * Nombre del miembro al que precede un comentario, para poder citarlo en el mensaje.
         *
         * @param {object[]} miembros   - Miembros del cuerpo del tipo.
         * @param {object}   comentario - Comentario encontrado dentro del cuerpo.
         * @returns El nombre del primer miembro que empieza después del comentario.
         */
        function miembroTras(miembros, comentario) {
            const siguiente = miembros.find((miembro) => miembro.range[0] >= comentario.range[1]);
            if (!siguiente) {
                return "este miembro";
            }
            const clave = siguiente.key ?? siguiente.id;
            return clave ? sourceCode.getText(clave) : sourceCode.getText(siguiente);
        }

        /**
         * Recorre el cuerpo de un tipo denunciando los comentarios de documentación que encuentre.
         *
         * @param {object}   cuerpo     - Nodo cuyo rango delimita el cuerpo del tipo.
         * @param {object[]} miembros   - Miembros declarados dentro.
         * @param {string}   nombreTipo - Nombre del tipo, para el mensaje.
         */
        function comprobarCuerpo(cuerpo, miembros, nombreTipo) {
            for (const comentario of sourceCode.getCommentsInside(cuerpo)) {
                const esJsdoc = comentario.type === "Block" && comentario.value.startsWith("*");
                const esLinea = comentario.type === "Line";
                if (!esJsdoc && !(incluirComentariosDeLinea && esLinea)) {
                    continue;
                }
                context.report({
                    loc: comentario.loc,
                    messageId: "documentaEnElBloque",
                    data: {tipo: nombreTipo, miembro: miembroTras(miembros, comentario)},
                });
            }
        }

        const visitantes = {
            TSInterfaceDeclaration(nodo) {
                comprobarCuerpo(nodo.body, nodo.body.body, sourceCode.getText(nodo.id));
            },
            TSEnumDeclaration(nodo) {
                // `TSEnumBody` es de typescript-eslint v8; antes los miembros colgaban del propio
                // nodo y no había cuerpo al que apuntar.
                const cuerpo = nodo.body ?? nodo;
                const miembros = nodo.body?.members ?? nodo.members ?? [];
                comprobarCuerpo(cuerpo, miembros, sourceCode.getText(nodo.id));
            },
        };
        if (incluirTiposLiterales) {
            visitantes.TSTypeLiteral = (nodo) => {
                const alias = nodo.parent?.type === "TSTypeAliasDeclaration" ? sourceCode.getText(nodo.parent.id) : "este tipo";
                comprobarCuerpo(nodo, nodo.members, alias);
            };
        }
        return visitantes;
    },
};
