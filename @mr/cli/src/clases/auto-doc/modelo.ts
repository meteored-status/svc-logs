/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:12 GMT
 * Hash: ba21ba671120d42592f54980bf74c458
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import type {ISchema} from "services-comun/modules/openapi/interface";

import type {IAviso} from "./avisos";

/** Valor JSON genérico devuelto por la conversión de literales AST de TypeScript a JSON. */
export type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};

/** Métodos HTTP que se documentan, en minúsculas como en OpenAPI. */
export type TMetodoOpenAPI = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

/**
 * Definición de un campo de esquema de validación (`query`/`post`/`headers`/`response`),
 * tal y como se declaran en los `RouteGroup` de `services-comun` (p.ej. `{type: "string", regexp: ...}`).
 * Se obtiene interpretando el AST de TypeScript, por lo que su forma no está garantizada en
 * tiempo de compilación; se asume de confianza por convención del proyecto. Las expresiones regulares
 * llegan como su texto literal (`/^\d+$/i`).
 *
 * @property type        - Tipo declarado (`string`, `number`, `boolean`, `array`, `object`).
 * @property regex       - Expresión regular de un parámetro de `query` (campo `regex` de `IQuery`).
 * @property regexp      - Expresión regular de un campo de `post`/`headers` (campo `regexp` de `BaseField`).
 * @property opcional    - Parámetro de `query` que puede faltar.
 * @property required    - Campo obligatorio de `post`/`headers`/`response`.
 * @property description - Descripción del campo.
 * @property options     - Valores permitidos de un parámetro de `query`.
 * @property exact       - Valor único permitido de un parámetro de `query`.
 * @property postType    - Origen del campo (`body` o `path`).
 * @property items       - Definición de los elementos de un array.
 * @property properties  - Campos de un objeto.
 */
export interface IEsquemaCampo {
    type?: string;
    regex?: string;
    regexp?: string;
    opcional?: boolean;
    required?: boolean;
    description?: string;
    options?: string[];
    exact?: string;
    postType?: string;
    items?: IEsquemaCampo;
    properties?: IEsquema;
}

export type IEsquema = Record<string, IEsquemaCampo>;

/**
 * Parámetro (de query o de cabecera) sacado de una propiedad de un tipo de `contract`.
 *
 * @property nombre      - Nombre de la propiedad.
 * @property schema      - Esquema del valor.
 * @property required    - Si el parámetro es obligatorio.
 * @property description - Descripción de la propiedad (JSDoc).
 */
export interface IParametroTipado {
    nombre: string;
    schema: ISchema;
    required: boolean;
    description?: string;
}

/**
 * Contrato de una ruta ya leído: esquemas de sus tipos y configuración del literal. La `post` y la `respuesta` del
 * literal de la ruta quedan sustituidas por estas si existen.
 *
 * @property post              - Esquema del cuerpo de la petición.
 * @property postOpcional      - El cuerpo puede faltar (su tipo admite `undefined`).
 * @property respuesta         - Esquema de `data` en la respuesta correcta. Sin él, `data` es libre.
 * @property respuestaOpcional - `data` puede faltar (el tipo admite `undefined`).
 * @property query             - Parámetros de query.
 * @property headers           - Parámetros de cabecera.
 * @property errores           - Códigos HTTP de error, sin repetir y en el orden escrito.
 * @property descripcion       - Descripción de la operación.
 * @property envoltorio        - `false` si la respuesta no lleva el envoltorio `{ok, expiracion, data}`.
 */
export interface IContratoLeido {
    post?: ISchema;
    postOpcional: boolean;
    respuesta?: ISchema;
    respuestaOpcional: boolean;
    query?: IParametroTipado[];
    headers?: IParametroTipado[];
    errores: number[];
    descripcion?: string;
    envoltorio: boolean;
}

/**
 * Operación documentable: un método sobre un path concreto.
 *
 * @property metodo     - Método HTTP.
 * @property path       - Path ya normalizado (sin `?`; las variantes opcionales ya se han expandido).
 * @property parametros - Nombres de los `{parametros}` del path, que van `in: path`.
 * @property resumen    - Texto de `resumen` de la expresión, tal como está escrito.
 * @property descripcion - `documentacion.descripcion` de la expresión.
 * @property deprecated - La expresión está marcada `deprecated`.
 * @property internal   - La expresión está marcada `internal` (se documenta con `x-internal: true`).
 * @property query      - Spec literal de `query`.
 * @property headers    - Spec literal de `headers`.
 * @property queryPath  - Parámetros que el `resumen` escribe tras un `?` (`?tz={timezone}`); se documentan como `query` obligatorios si no están ya declarados.
 * @property post       - Spec literal de `post`.
 * @property response   - Spec literal de `response`.
 * @property contrato   - Contrato de tipos de la ruta (`Contract<T>()`), si lo tiene.
 * @property ubicacion  - `fichero:línea` de la expresión.
 */
export interface IOperacionRuta {
    metodo: TMetodoOpenAPI;
    path: string;
    parametros: string[];
    resumen: string;
    descripcion?: string;
    deprecated: boolean;
    internal: boolean;
    query?: IEsquema;
    headers?: IEsquema;
    queryPath?: string[];
    post?: IEsquema;
    response?: IEsquema;
    contrato?: IContratoLeido;
    ubicacion: string;
}

/**
 * Grupo de rutas (clase que extiende `RouteGroup`) con las operaciones que declara.
 *
 * @property nombre      - Nombre de la clase; es el tag de sus operaciones.
 * @property operaciones - Operaciones documentables.
 */
export interface IGrupoRutas {
    nombre: string;
    operaciones: IOperacionRuta[];
}

/**
 * Resultado de leer las rutas de un programa.
 *
 * @property grupos      - Grupos de rutas, en orden de aparición en el código.
 * @property avisos      - Incidencias de la lectura.
 * @property componentes - Esquemas con nombre (`components.schemas`) a los que apuntan los `$ref` de los contratos.
 */
export interface IResultadoRutas {
    grupos: IGrupoRutas[];
    avisos: IAviso[];
    componentes: Record<string, ISchema>;
}

/**
 * Servicio (deployment) para el que se genera un documento OpenAPI.
 *
 * @property name - Nombre del deployment (título del documento).
 */
export interface IServicio {
    name: string;
}
