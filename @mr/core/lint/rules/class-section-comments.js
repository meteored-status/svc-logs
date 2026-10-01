import {anclaDeInsercion, rangoDeLineaCompleta} from "../lib/utilidades.js";

/**
 * Texto exacto que debe llevar dentro cada comentario de sección. Se compara con el contenido del
 * comentario ya recortado, así que `/*STATIC*\/` y `/*   STATIC   *\/` valen los dos.
 */
const MARCADOR_STATIC = "STATIC";
const MARCADOR_INSTANCE = "INSTANCE";

/**
 * Si un miembro de clase es estático. Un bloque `static {…}` lo es aunque no lleve `static: true`:
 * es un `StaticBlock`, sin esa propiedad, y sin mirarlo aparte se contaba como de instancia y la regla
 * pedía un `/* INSTANCE *\/` encima de él.
 *
 * @param {object} miembro - Nodo del cuerpo de la clase.
 * @returns `true` si pertenece a la sección de estáticos.
 */
function esEstatico(miembro) {
    return miembro.static === true || miembro.type === "StaticBlock";
}

/**
 * Comprueba si un comentario es uno de los marcadores de sección.
 *
 * @param {object} comentario - Comentario a examinar.
 * @param {string} texto      - Marcador esperado.
 * @returns `true` si es un comentario de bloque cuyo contenido es exactamente ese marcador.
 */
function esMarcador(comentario, texto) {
    return comentario.type === "Block" && comentario.value.trim() === texto;
}

/**
 * Regla `mrpack/class-section-comments`.
 *
 * Convención: «las propiedades y métodos se agrupan en dos bloques bien diferenciados, precedidos
 * cada uno por un comentario de sección»; y «si la clase no tiene miembros estáticos, se omite el
 * bloque STATIC y no es necesario el comentario INSTANCE».
 *
 * De ahí las tres comprobaciones: en una clase **con** miembros estáticos hacen falta los dos
 * marcadores (el de instancia solo si hay miembros de instancia, claro), y en una clase **sin**
 * ellos sobra el marcador de estáticos. El de instancia en una clase sin estáticos no se toca: la
 * convención dice que «no es necesario», no que esté prohibido.
 */
export default {
    meta: {
        type: "layout",
        docs: {
            description: "Exige los comentarios de sección STATIC/INSTANCE en las clases que tienen miembros estáticos.",
        },
        fixable: "code",
        schema: [],
        messages: {
            faltaStatic: "Falta el comentario de sección de miembros estáticos antes de este miembro.",
            faltaInstance: "Falta el comentario de sección de miembros de instancia antes de este miembro.",
            staticSobrante: "Esta clase no tiene miembros estáticos: sobra el comentario de sección de estáticos.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        /**
         * Exige el marcador correspondiente delante del primer miembro de una sección.
         *
         * @param {object} miembro   - Primer miembro de la sección.
         * @param {string} texto     - Marcador esperado.
         * @param {string} messageId - Mensaje a emitir si falta.
         */
        function exigirMarcador(miembro, texto, messageId) {
            const previos = sourceCode.getCommentsBefore(miembro);
            if (previos.some((comentario) => esMarcador(comentario, texto))) {
                return;
            }
            const ancla = anclaDeInsercion(sourceCode, miembro);
            const sangria = " ".repeat(ancla.loc.start.column);
            context.report({
                node: miembro,
                messageId,
                fix: (fixer) => fixer.insertTextBeforeRange(ancla.range, `/* ${texto} */\n\n${sangria}`),
            });
        }

        return {
            ClassBody(nodo) {
                const estaticos = nodo.body.filter(esEstatico);
                if (estaticos.length === 0) {
                    const sobrante = sourceCode.getCommentsInside(nodo)
                        .find((comentario) => esMarcador(comentario, MARCADOR_STATIC));
                    if (sobrante) {
                        context.report({
                            loc: sobrante.loc,
                            messageId: "staticSobrante",
                            fix: (fixer) => fixer.removeRange(rangoDeLineaCompleta(sourceCode, sobrante)),
                        });
                    }
                    return;
                }
                exigirMarcador(estaticos[0], MARCADOR_STATIC, "faltaStatic");
                const deInstancia = nodo.body.filter((miembro) => !esEstatico(miembro));
                if (deInstancia.length > 0) {
                    exigirMarcador(deInstancia[0], MARCADOR_INSTANCE, "faltaInstance");
                }
            },
        };
    },
};
