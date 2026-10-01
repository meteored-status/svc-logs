/**
 * Nodos que la regla examina siempre: definiciones de función con cuerpo, que son las que la
 * convención llama «funciones y métodos».
 */
const IMPLEMENTACIONES = [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "TSDeclareFunction",
    "TSEmptyBodyFunctionExpression",
];

/**
 * Nodos que solo se examinan con `incluirTipos`: firmas declaradas en interfaces y tipos de
 * callback. Van aparte porque un tipo de callback ajeno (el `onChange` que exige una librería, por
 * ejemplo) no siempre está en nuestra mano reescribirlo.
 */
const TIPOS_DE_FUNCION = [
    "TSMethodSignature",
    "TSFunctionType",
];

const PATRON_TIPO_POR_DEFECTO = "Config$";
const PATRON_NOMBRE_POR_DEFECTO = "^(config|opciones|options|opts)$";

/**
 * Regla `mrpack/config-object-params`.
 *
 * Convención: «en lugar de usar `?` o `=` directamente en parámetros posicionales, agruparlos en un
 * objeto de configuración (último parámetro)», con la salida prevista de «mantener `config` en la
 * firma y desestructurarlo al inicio de la función» cuando la firma se alarga demasiado.
 *
 * Por eso se acepta que el **último** parámetro sea opcional o tenga valor por defecto siempre que
 * tenga forma de objeto de configuración: desestructurado (`{verbose = false}: IFooConfig = {}`),
 * de tipo literal, de un tipo cuyo nombre acabe en `Config`, o llamado `config`/`opciones`. Ese
 * último criterio es lo que hace que `crear(datos, movimiento?: IMovimientoDePrestamoConfig)` pase:
 * es justo el idiom que la convención pide, con nombre de dominio.
 *
 * **Un único opcional al final no se denuncia**, tenga la forma que tenga: `buscar(id, transaction?)`
 * o `render(params = {})`. Un objeto de configuración con una sola propiedad no ordena nada, y es el
 * caso más común con diferencia. La regla salta cuando hay **dos o más** opcionales, que es cuando
 * el orden posicional empieza a obligar a pasar `undefined` para llegar al siguiente; entonces se
 * denuncian todos los que no sean el objeto de configuración final.
 *
 * `permitirUltimo` lista los nombres que pueden ir opcionales en última posición **sin** tener
 * forma de configuración aunque haya otros opcionales delante: `transaction?: Transaction`, que es
 * como se pasa la transacción en todo el acceso a datos, no cuenta como el que sobra. El nombre
 * tiene que coincidir entero, y solo vale en el último parámetro.
 */
export default {
    meta: {
        type: "suggestion",
        docs: {
            description: "Prohíbe parámetros posicionales opcionales o con valor por defecto; agrúpalos en un objeto de configuración.",
        },
        schema: [{
            type: "object",
            properties: {
                patronTipoConfig: {type: "string"},
                patronNombreConfig: {type: "string"},
                incluirTipos: {type: "boolean"},
                permitirUltimo: {type: "array", items: {type: "string"}},
            },
            additionalProperties: false,
        }],
        messages: {
            agrupaEnConfig: "`{{parametro}}` es un parámetro posicional opcional o con valor por defecto: agrúpalo en un objeto de configuración como último parámetro.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const opciones = context.options[0] ?? {};
        const patronTipo = new RegExp(opciones.patronTipoConfig ?? PATRON_TIPO_POR_DEFECTO);
        const patronNombre = new RegExp(opciones.patronNombreConfig ?? PATRON_NOMBRE_POR_DEFECTO);
        const incluirTipos = opciones.incluirTipos ?? false;
        const permitirUltimo = new Set(opciones.permitirUltimo ?? []);

        /**
         * Si un parámetro tiene forma de objeto de configuración, el único que puede ser opcional.
         *
         * @param {object} parametro - Nodo del parámetro, con o sin valor por defecto.
         * @returns `true` si vale como objeto de configuración.
         */
        function esObjetoDeConfiguracion(parametro) {
            const desnudo = parametro.type === "AssignmentPattern" ? parametro.left : parametro;
            if (desnudo.type === "ObjectPattern") {
                return true;
            }
            if (desnudo.type !== "Identifier") {
                return false;
            }
            if (patronNombre.test(desnudo.name)) {
                return true;
            }
            const anotacion = desnudo.typeAnnotation?.typeAnnotation;
            if (!anotacion) {
                return false;
            }
            if (anotacion.type === "TSTypeLiteral") {
                return true;
            }
            return anotacion.type === "TSTypeReference"
                && anotacion.typeName.type === "Identifier"
                && patronTipo.test(anotacion.typeName.name);
        }

        /**
         * Si un parámetro es opcional (`?`) o tiene valor por defecto (`=`).
         *
         * @param {object} parametro - Nodo del parámetro.
         * @returns `true` si se puede omitir al llamar.
         */
        function esOpcional(parametro) {
            return parametro.type === "AssignmentPattern" || parametro.optional === true;
        }

        /**
         * Comprueba los parámetros de un nodo función.
         *
         * @param {object} nodo - Nodo con `params`.
         */
        function comprobar(nodo) {
            const opcionales = nodo.params.filter(esOpcional).length;
            nodo.params.forEach((parametro, indice) => {
                const desnudo = parametro.type === "AssignmentPattern" ? parametro.left : parametro;
                if (!esOpcional(parametro)) {
                    return;
                }
                const esUltimo = indice === nodo.params.length - 1;
                // Un solo opcional, y al final: no hay nada que agrupar.
                if (esUltimo && opcionales === 1) {
                    return;
                }
                if (esUltimo && esObjetoDeConfiguracion(parametro)) {
                    return;
                }
                if (esUltimo && desnudo.type === "Identifier" && permitirUltimo.has(desnudo.name)) {
                    return;
                }
                context.report({
                    node: parametro,
                    messageId: "agrupaEnConfig",
                    data: {parametro: desnudo.type === "Identifier" ? desnudo.name : sourceCode.getText(parametro)},
                });
            });
        }

        const tipos = incluirTipos ? [...IMPLEMENTACIONES, ...TIPOS_DE_FUNCION] : IMPLEMENTACIONES;
        return Object.fromEntries(tipos.map((tipo) => [tipo, comprobar]));
    },
};
