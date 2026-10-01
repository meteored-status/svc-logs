import {nombreDeClave} from "../lib/utilidades.js";

/**
 * Regla `mrpack/class-property-init-in-constructor`.
 *
 * Convención: «las propiedades de instancia se inicializan siempre en el cuerpo del constructor,
 * nunca en la declaración de la propiedad. Esto aplica tanto a propiedades primitivas como a
 * objetos y arrays».
 *
 * Solo mira propiedades **de instancia**: las estáticas quedan fuera a propósito, porque no hay
 * constructor donde inicializarlas y la propia convención habla solo de instancia (y el código del
 * repo las declara con su valor, ver `ClaveCifrado`).
 *
 * No se ofrece autocorrección: mover el valor al constructor exige crearlo si no existe, colocar la
 * asignación en el orden correcto respecto a las demás y respetar un posible `super()`. Es un
 * cambio con criterio, no una reescritura mecánica.
 */
export default {
    meta: {
        type: "suggestion",
        docs: {
            description: "Exige inicializar las propiedades de instancia en el constructor, no en su declaración.",
        },
        schema: [{
            type: "object",
            properties: {
                permitirFunciones: {type: "boolean"},
            },
            additionalProperties: false,
        }],
        messages: {
            inicializaEnConstructor: "Inicializa `{{propiedad}}` en el cuerpo del constructor, no en la declaración.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const {permitirFunciones = false} = context.options[0] ?? {};

        /**
         * Comprueba una declaración de propiedad de clase.
         *
         * @param {object} nodo - `PropertyDefinition` o `AccessorProperty`.
         */
        function comprobar(nodo) {
            if (nodo.static === true || nodo.declare === true || !nodo.value) {
                return;
            }
            const esFuncion = nodo.value.type === "ArrowFunctionExpression" || nodo.value.type === "FunctionExpression";
            if (permitirFunciones && esFuncion) {
                return;
            }
            context.report({
                node: nodo.key,
                messageId: "inicializaEnConstructor",
                data: {propiedad: nombreDeClave(sourceCode, nodo.key)},
            });
        }

        return {
            PropertyDefinition: comprobar,
            AccessorProperty: comprobar,
        };
    },
};
