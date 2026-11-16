/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 904b8484830a2555048383d45128b7a0
 * Versión: 2026.11.11+2-juancmartinez
 * Anterior: 2026.10.20+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

/**
 * Documento OpenAPI 3.1 generado por `mrpack autodoc`.
 *
 * @property openapi    - Versión de la especificación.
 * @property info       - Metadatos del documento.
 * @property servers    - Servidores donde se expone la API.
 * @property paths      - Rutas documentadas.
 * @property components - Esquemas y ejemplos reutilizables (`$ref`).
 * @property tags       - Etiquetas con las que se agrupan las operaciones.
 */
export interface IOpenAPI {
    openapi: "3.1.0";
    info: IInfo;
    servers: IServer[];
    paths?: IPaths;
    components?: IComponents;
    tags?: ITag[];
}

export interface IInfo {
    title: string;
    description: string;
    version: "1";
}

export interface IServer {
    url: string;
}

export interface IPaths {
    [path: string]: IPath;
}

/**
 * Operaciones de una ruta, una por método HTTP.
 *
 * @property get        - Operación `GET`.
 * @property post       - Operación `POST`.
 * @property put        - Operación `PUT`.
 * @property delete     - Operación `DELETE`.
 * @property patch      - Operación `PATCH`.
 * @property head       - Operación `HEAD`.
 * @property options    - Operación `OPTIONS`.
 * @property parameters - Parámetros comunes a todas las operaciones de la ruta (p. ej. los de `path`).
 */
export interface IPath {
    get?: IHTTPMethod;
    post?: IHTTPMethod;
    put?: IHTTPMethod;
    delete?: IHTTPMethod;
    patch?: IHTTPMethod;
    head?: IHTTPMethod;
    options?: IHTTPMethod;
    parameters?: IParameter[];
}

export interface IComponents {
    schemas?: ISchemas;
    examples?: IExamples;
    securitySchemes?: ISecuritySchemes;
}

export interface ISecuritySchemes {
    [name: string]: ISecurityScheme;
}

/**
 * Esquema de seguridad (`components.securitySchemes`). Se usa `apiKey` en cabecera para `Authorization`, porque
 * OpenAPI ignora los parámetros `in: header` llamados `Authorization`, `Accept` o `Content-Type`.
 *
 * @property type        - Tipo de esquema (`apiKey`).
 * @property in          - Dónde viaja la clave.
 * @property name        - Nombre de la cabecera.
 * @property description - Descripción.
 */
export interface ISecurityScheme {
    type: "apiKey";
    in: "header" | "query" | "cookie";
    name: string;
    description?: string;
}

export interface IExamples {
    [name: string]: IExample;
}

export interface ISchemas {
    [name: string]: ISchema;
}

/**
 * Operación de una ruta (el objeto `Operation` de OpenAPI).
 *
 * @property tags        - Etiquetas de la operación.
 * @property summary     - Resumen de una línea.
 * @property description - Descripción larga.
 * @property operationId - Identificador único de la operación en el documento.
 * @property deprecated  - Si `true`, la operación está obsoleta.
 * @property x-internal  - Extensión: si `true`, la ruta es de uso interno (`internal` del `RouteGroup`).
 * @property parameters  - Parámetros de `path`, `query`, `header` o `cookie`.
 * @property requestBody - Cuerpo de la petición.
 * @property responses   - Respuestas por código HTTP.
 */
export interface IHTTPMethod {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    deprecated?: boolean;
    "x-internal"?: boolean;
    parameters?: IParameter[];
    requestBody?: IRequestBody;
    responses?: IResponses;
    security?: Record<string, string[]>[];
}

export interface IGet extends IHTTPMethod {
    description: string;
}

export interface IPost extends IHTTPMethod {
    description: string;
    requestBody?: IRequestBody;
}

export interface IParameter {
    name: string;
    in: "header"|"path"|"query"|"cookie";
    description?: string;
    required?: boolean;
    schema?: ISchema;
}

export interface IRequestBody {
    description?: string;
    content: IContent;
    required?: boolean;
}

/**
 * Esquema JSON (el objeto `Schema` de OpenAPI 3.1). Es recursivo: el mismo tipo describe propiedades,
 * elementos de arrays y alternativas.
 *
 * @property type                 - Tipo, o lista de tipos (`["string", "null"]`).
 * @property properties           - Propiedades de un objeto.
 * @property required             - Propiedades obligatorias de un objeto.
 * @property items                - Esquema de los elementos de un array.
 * @property prefixItems          - Esquemas por posición de una tupla.
 * @property additionalProperties - Esquema de las propiedades no listadas, o `false`.
 * @property enum                 - Valores permitidos.
 * @property const                - Único valor permitido.
 * @property anyOf                - Debe cumplir al menos una alternativa.
 * @property oneOf                - Debe cumplir exactamente una alternativa.
 * @property allOf                - Debe cumplir todas.
 * @property pattern              - Expresión regular (sin barras ni flags) que debe cumplir una cadena.
 * @property format               - Formato de una cadena o número (`date-time`...).
 * @property description          - Descripción.
 * @property deprecated           - Si `true`, está obsoleto.
 * @property examples             - Ejemplos.
 * @property $ref                 - Referencia a otro esquema (`#/components/schemas/Nombre`).
 */
export interface ISchema {
    type?: string | string[];
    properties?: IProperties;
    required?: string[];
    items?: ISchema;
    prefixItems?: ISchema[];
    additionalProperties?: boolean | ISchema;
    enum?: unknown[];
    const?: unknown;
    anyOf?: ISchema[];
    oneOf?: ISchema[];
    allOf?: ISchema[];
    pattern?: string;
    format?: string;
    description?: string;
    deprecated?: boolean;
    examples?: unknown[];
    $ref?: string;
}

export interface IProperties {
    [name: string]: IProperty;
}

/** Esquema de una propiedad: es un {@link ISchema} cualquiera. */
export type IProperty = ISchema;

export interface IExample {
    value?: any;
    summary?: string;
    description?: string;
    externalValue?: string;
    $ref?: string;
}

/** Esquema de los elementos de un array: es un {@link ISchema} cualquiera. */
export type IItems = ISchema;

export interface IResponses {
    [code: string]: IResponse;
}

export interface IResponse {
    description: string;
    content?: IContent;
}

export interface IContent {
    [type: string]: IMediaType;
}

export interface IMediaType {
    schema: ISchema;
    examples?: IExamples;
}

export interface ITag {
    name: string;
    description?: string;
}
