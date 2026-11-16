/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 11:55:33 GMT
 * Hash: 8c2a42a4b2ce9a81d7dd2ee98284df51
 * Versión: 2026.11.12+1-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {createHash} from "node:crypto";

import type {IContent, IHTTPMethod, IOpenAPI, IParameter, IPath, IResponses, ISchema, ISecurityScheme, ITag} from "services-comun/modules/openapi/interface";

import type {IContratoLeido, IEsquema, IEsquemaCampo, IGrupoRutas, IOperacionRuta, IParametroTipado, IServicio} from "./modelo";
import {compararParaNombres} from "./visibilidad";
import {patronDeRegex} from "./literal";

/** Métodos cuyas operaciones documentan un cuerpo de petición. */
const METODOS_CON_CUERPO = ["post", "put", "patch"];

/** Texto de los códigos de error HTTP habituales. */
const TEXTO_ERROR: Record<number, string> = {
    400: "Solicitud incorrecta",
    401: "No autenticado",
    403: "Acceso prohibido",
    404: "No encontrado",
    405: "Método no permitido",
    409: "Conflicto",
    410: "Recurso eliminado",
    413: "Cuerpo demasiado grande",
    415: "Tipo de contenido no admitido",
    422: "Entidad no procesable",
    429: "Demasiadas peticiones",
    500: "Error interno del servidor",
    502: "Puerta de enlace incorrecta",
    503: "Servicio no disponible",
    504: "Tiempo de espera agotado",
};

const REF = "#/components/schemas/";

/** Nombre del esquema de seguridad con el que se documenta la cabecera `Authorization`. */
const ESQUEMA_AUTORIZACION = "IdToken";

/** Cabeceras que OpenAPI ignora como parámetro (`in: header`): `Authorization` va como seguridad, el resto no se documenta. */
const CABECERAS_IGNORADAS = ["accept", "content-type"];

/**
 * Construye el documento OpenAPI de un servicio a partir de las operaciones leídas del código. La salida es
 * determinista: el orden de paths, operaciones y propiedades es el del código.
 *
 * Las operaciones con `contract` llevan sus tipos como `$ref` a `components.schemas`, su respuesta correcta
 * envuelta en `RespuestaOK_<Nombre>` (`{ok, expiracion, data}`) y una respuesta por cada código de `errors`,
 * con el esquema común `RespuestaKO`. Las que no tienen contrato conservan la forma de siempre.
 *
 * Las operaciones se construyen en el orden de {@link compararParaNombres} (las públicas primero) y se colocan en el
 * del código. Así lo que se reparte por orden de llegada —el `operationId` que se lleva el sufijo `_2` y la
 * `description` de `securitySchemes.IdToken`— no depende de las operaciones privadas. Los `tags` salen por nombre.
 *
 * @param grupos      - Grupos de rutas del servicio.
 * @param servicio    - Servicio (deployment) para el que se genera.
 * @param componentes - Esquemas con nombre a los que apuntan los `$ref` de los contratos.
 */
export function construirOpenAPI(grupos: IGrupoRutas[], servicio: IServicio, componentes: Record<string, ISchema> = {}): IOpenAPI {
    const paths: Record<string, IPath> = {};
    const tags: ITag[] = [];
    const operationIds = new Set<string>();
    const esquemas: Record<string, ISchema> = {...componentes};
    const seguridad: Record<string, ISecurityScheme> = {};

    const construidas = new Map<IOperacionRuta, IHTTPMethod>();
    const todas = grupos.flatMap(grupo => grupo.operaciones.map(operacion => ({operacion, tag: grupo.nombre})));
    for (const {operacion, tag} of todas.sort((a, b) => compararParaNombres(a.operacion, b.operacion))) {
        construidas.set(operacion, construirOperacion(operacion, tag, operationIds, esquemas, seguridad));
    }

    for (const grupo of grupos) {
        if (grupo.operaciones.length === 0) {
            continue;
        }
        if (!tags.some(t => t.name === grupo.nombre)) {
            tags.push({name: grupo.nombre, description: `Rutas de ${grupo.nombre}`});
        }
        for (const operacion of grupo.operaciones) {
            const item = paths[operacion.path] ??= {};
            item[operacion.metodo] = construidas.get(operacion) as IHTTPMethod;
        }
    }
    // Por nombre y no por el orden de los grupos, que sigue el orden en que TypeScript descubre los ficheros: un `import`
    // nuevo en código privado lo cambiaría, y el orden de un array sí cuenta en la huella del documento `public`.
    tags.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const doc: IOpenAPI = {
        openapi: "3.1.0",
        info: {title: servicio.name, version: "1", description: "Documentación automática de la API"},
        servers: [],
        paths,
        tags,
    };
    if (Object.keys(esquemas).length > 0 || Object.keys(seguridad).length > 0) {
        doc.components = {};
        if (Object.keys(esquemas).length > 0) {
            doc.components.schemas = ordenar(esquemas);
        }
        if (Object.keys(seguridad).length > 0) {
            doc.components.securitySchemes = seguridad;
        }
    }

    return doc;
}

function ordenar(esquemas: Record<string, ISchema>): Record<string, ISchema> {
    const salida: Record<string, ISchema> = {};
    for (const nombre of Object.keys(esquemas).sort()) {
        salida[nombre] = esquemas[nombre];
    }

    return salida;
}

function construirOperacion(operacion: IOperacionRuta, tag: string, operationIds: Set<string>, esquemas: Record<string, ISchema>, seguridad: Record<string, ISecurityScheme>): IHTTPMethod {
    const salida: IHTTPMethod = {
        tags: [tag],
        summary: operacion.descripcion ?? operacion.resumen,
        operationId: operationIdDe(operacion, operationIds),
    };
    if (operacion.deprecated) {
        salida.deprecated = true;
    }
    if (operacion.internal) {
        salida["x-internal"] = true;
    }

    const parametros: IParameter[] = operacion.parametros.map(nombre => ({name: nombre, in: "path", required: true, schema: {type: "string"}}));
    const contrato = operacion.contrato;
    if (contrato?.query !== undefined) {
        parametros.push(...parametrosTipados(contrato.query, "query"));
    } else if (operacion.query !== undefined) {
        parametros.push(...parametrosDe(operacion.query, "query"));
    }
    for (const nombre of operacion.queryPath ?? []) {
        if (!parametros.some(p => p.in === "query" && p.name === nombre)) {
            parametros.push({name: nombre, in: "query", required: true, schema: {type: "string"}});
        }
    }

    let cabeceras: IParameter[] = [];
    if (contrato?.headers !== undefined) {
        cabeceras = parametrosTipados(contrato.headers, "header");
    } else if (operacion.headers !== undefined) {
        cabeceras = parametrosDe(operacion.headers, "header");
    }
    for (const cabecera of cabeceras) {
        const nombre = cabecera.name.toLowerCase();
        if (nombre === "authorization") {
            const esquema: ISecurityScheme = {type: "apiKey", in: "header", name: "Authorization"};
            if (cabecera.description !== undefined) {
                esquema.description = cabecera.description;
            }
            seguridad[ESQUEMA_AUTORIZACION] ??= esquema;
            salida.security = cabecera.required === true ? [{[ESQUEMA_AUTORIZACION]: []}] : [{[ESQUEMA_AUTORIZACION]: []}, {}];
        } else if (!CABECERAS_IGNORADAS.includes(nombre)) {
            parametros.push(cabecera);
        }
    }
    if (parametros.length > 0) {
        salida.parameters = parametros;
    }

    if (METODOS_CON_CUERPO.includes(operacion.metodo)) {
        if (contrato?.post !== undefined) {
            salida.requestBody = {content: {"application/json": {schema: contrato.post}}};
            if (!contrato.postOpcional) {
                salida.requestBody.required = true;
            }
        } else if (operacion.post !== undefined) {
            const cuerpo = esquemaObjeto(operacion.post, true);
            if (Object.keys(cuerpo.properties ?? {}).length > 0) {
                salida.requestBody = {content: {"application/json": {schema: cuerpo}}};
            }
        }
    }

    salida.responses = contrato === undefined ? respuestasLiterales(operacion) : respuestasContrato(operacion, contrato, esquemas);

    return salida;
}

function respuestasLiterales(operacion: IOperacionRuta): IResponses {
    return {
        "200": operacion.response === undefined
            ? {description: "Respuesta correcta"}
            : {description: "Respuesta correcta", content: {"application/json": {schema: esquemaObjeto(operacion.response, false)}}},
    };
}

/**
 * Respuestas de una operación con contrato: la correcta (envuelta salvo `envelope: false`) y una por código de
 * error. Registra en `esquemas` los envoltorios que hagan falta.
 */
function respuestasContrato(operacion: IOperacionRuta, contrato: IContratoLeido, esquemas: Record<string, ISchema>): IResponses {
    const respuestas: IResponses = {};
    const json = (schema: ISchema): IContent => ({"application/json": {schema}});
    // Sin tipo de respuesta en el contrato, vale la spec literal `response` (como con post, query y headers).
    const data = contrato.respuesta ?? (operacion.response === undefined ? undefined : esquemaObjeto(operacion.response, false));

    if (contrato.envoltorio) {
        respuestas["200"] = {description: "Respuesta correcta", content: json({$ref: `${REF}${registrarEnvoltorioOK(data, contrato.respuestaOpcional, esquemas)}`})};
    } else {
        respuestas["200"] = data === undefined ? {description: "Respuesta correcta"} : {description: "Respuesta correcta", content: json(data)};
    }

    for (const codigo of contrato.errores) {
        const descripcion = TEXTO_ERROR[codigo] ?? `Error ${codigo}`;
        if (contrato.envoltorio) {
            esquemas["RespuestaKO"] ??= esquemaKO();
            respuestas[String(codigo)] = {description: descripcion, content: json({$ref: `${REF}RespuestaKO`})};
        } else {
            respuestas[String(codigo)] = {description: descripcion};
        }
    }

    return respuestas;
}

/**
 * Registra el envoltorio de la respuesta correcta (`{ok: true, expiracion, data}`) y devuelve su nombre. Lo
 * identifica el tipo de `data`, no la operación: `RespuestaOK_<Nombre>` si es un `$ref`, `RespuestaOK_<hash>` (del
 * contenido) si es un esquema en línea y `RespuestaOK` sin `data`. Con `data` opcional lleva el sufijo
 * `_opcional`, porque su `required` es distinto.
 */
function registrarEnvoltorioOK(data: ISchema | undefined, opcional: boolean, esquemas: Record<string, ISchema>): string {
    let nombre = "RespuestaOK";
    if (data !== undefined) {
        const identidad = data.$ref === undefined ? createHash("sha1").update(JSON.stringify(data)).digest("hex").slice(0, 8) : data.$ref.slice(REF.length);
        nombre = `RespuestaOK_${identidad}${opcional ? "_opcional" : ""}`;
    }

    const properties: Record<string, ISchema> = {
        ok: {type: "boolean", const: true},
        expiracion: {type: "number", description: "Fecha de expiración de la respuesta, en milisegundos desde la época Unix"},
    };
    const required = ["ok", "expiracion"];
    if (data !== undefined) {
        properties["data"] = data;
        if (!opcional) {
            required.push("data");
        }
    }
    esquemas[nombre] ??= {type: "object", properties, required};

    return nombre;
}

function esquemaKO(): ISchema {
    return {
        type: "object",
        properties: {
            ok: {type: "boolean", const: false},
            expiracion: {type: "number", description: "Fecha de la respuesta, en milisegundos desde la época Unix"},
            info: {
                type: "object",
                properties: {
                    message: {type: "string", description: "Mensaje del error"},
                    code: {type: "number", description: "Código de error de la aplicación, si lo hay"},
                    extra: {description: "Información adicional (solo en desarrollo)"},
                },
                required: ["message"],
            },
        },
        required: ["ok", "expiracion", "info"],
    };
}

function parametrosTipados(parametros: IParametroTipado[], lugar: "query" | "header"): IParameter[] {
    return parametros.map(p => {
        const parametro: IParameter = {name: p.nombre, in: lugar, required: p.required, schema: p.schema};
        if (p.description !== undefined) {
            parametro.description = p.description;
        }

        return parametro;
    });
}

function operationIdDe(operacion: IOperacionRuta, usados: Set<string>): string {
    const slug = operacion.path.replace(/[{}]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
    const base = `${operacion.metodo}_${slug === "" ? "raiz" : slug}`;
    let id = base;
    for (let i = 2; usados.has(id); i++) {
        id = `${base}_${i}`;
    }
    usados.add(id);

    return id;
}

function parametrosDe(spec: IEsquema, lugar: "query" | "header"): IParameter[] {
    return Object.keys(spec).map(nombre => {
        const campo = spec[nombre];
        const parametro: IParameter = {
            name: nombre,
            in: lugar,
            required: campo.required ?? !campo.opcional,
            schema: esquemaCampo(campo),
        };
        if (campo.description) {
            // La descripción va en el parámetro, no repetida dentro de su esquema.
            parametro.description = campo.description;
            delete parametro.schema!.description;
        }

        return parametro;
    });
}

/**
 * Esquema de un objeto descrito por una spec literal. En el cuerpo de una petición se omiten los campos que
 * viajan en la URL (`postType: "path"`).
 */
function esquemaObjeto(spec: IEsquema, esPeticion: boolean): ISchema {
    const properties: Record<string, ISchema> = {};
    const required: string[] = [];
    for (const nombre of Object.keys(spec)) {
        const campo = spec[nombre];
        if (esPeticion && campo.postType === "path") {
            continue;
        }
        properties[nombre] = esquemaCampo(campo);
        if (campo.required) {
            required.push(nombre);
        }
    }
    const esquema: ISchema = {type: "object", properties};
    if (required.length > 0) {
        esquema.required = required;
    }

    return esquema;
}

function esquemaCampo(campo: IEsquemaCampo): ISchema {
    const patron = typeof campo.regexp === "string" ? campo.regexp : campo.regex;
    const esquema: ISchema = {};
    if (campo.exact !== undefined) {
        esquema.const = campo.exact;
    }
    if (Array.isArray(campo.options)) {
        esquema.enum = campo.options;
    }
    esquema.type = campo.type ?? "string";
    if (typeof patron === "string") {
        esquema.type = "string";
        esquema.pattern = patronDeRegex(patron);
    }
    if (campo.description) {
        esquema.description = campo.description;
    }
    if (campo.type === "array" && campo.items !== undefined) {
        esquema.items = esquemaCampo(campo.items);
    } else if (campo.type === "object") {
        const objeto = esquemaObjeto(campo.properties ?? {}, false);
        esquema.properties = objeto.properties;
        if (objeto.required !== undefined) {
            esquema.required = objeto.required;
        }
    }

    return esquema;
}
