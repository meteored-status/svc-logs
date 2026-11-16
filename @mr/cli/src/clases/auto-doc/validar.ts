/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:12 GMT
 * Hash: 1a2c78184b96e21457c440d2ac8b819c
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import type {IOpenAPI, IParameter} from "services-comun/modules/openapi/interface";

import type {IAviso} from "./avisos";

const METODOS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

/**
 * Comprueba que un documento OpenAPI generado es coherente. Se ejecuta siempre; cualquier incidencia es un
 * `error` y el servicio no se escribe.
 *
 * - Todo `$ref` apunta a algo que existe.
 * - Ningún path lleva `?` y todos empiezan por `/`.
 * - Cada `{param}` del path está declarado como parámetro `in: path` y es obligatorio.
 * - No hay `operationId` repetidos ni parámetros repetidos en una operación.
 * - Todo `security` de una operación referencia un esquema de `components.securitySchemes`.
 *
 * @param doc        - Documento a validar.
 * @param ubicaciones - `fichero:línea` de cada operación (`método path`, con el método en minúsculas), para situar los errores.
 */
export function validarOpenAPI(doc: IOpenAPI, ubicaciones: ReadonlyMap<string, string> = new Map()): IAviso[] {
    const errores: IAviso[] = [];
    const error = (mensaje: string, ubicacion?: string): void => {
        errores.push(ubicacion === undefined ? {severidad: "error", mensaje: `${doc.info.title}: ${mensaje}`} : {severidad: "error", mensaje: `${doc.info.title}: ${mensaje}`, ubicacion});
    };

    const operationIds = new Set<string>();
    for (const [path, item] of Object.entries(doc.paths ?? {})) {
        if (!path.startsWith("/")) {
            error(`el path «${path}» no empieza por «/»`);
        }
        if (path.includes("?")) {
            error(`el path «${path}» contiene «?»`);
        }
        const declarados = [...path.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
        for (const metodo of METODOS) {
            const operacion = item[metodo];
            if (operacion === undefined) {
                continue;
            }
            const parametros: IParameter[] = [...item.parameters ?? [], ...operacion.parameters ?? []];
            for (const nombre of declarados) {
                const parametro = parametros.find(p => p.in === "path" && p.name === nombre);
                if (parametro === undefined || parametro.required !== true) {
                    error(`${metodo.toUpperCase()} ${path}: el parámetro «{${nombre}}» no está declarado como parámetro de path obligatorio`, ubicaciones.get(`${metodo} ${path}`));
                }
            }
            const claves = new Set<string>();
            for (const p of parametros) {
                const clave = `${p.in}:${p.name}`;
                if (claves.has(clave)) {
                    error(`${metodo.toUpperCase()} ${path}: el parámetro ${clave} está repetido`, ubicaciones.get(`${metodo} ${path}`));
                }
                claves.add(clave);
            }
            for (const requisito of operacion.security ?? []) {
                for (const esquema of Object.keys(requisito)) {
                    if (doc.components?.securitySchemes?.[esquema] === undefined) {
                        error(`${metodo.toUpperCase()} ${path}: el esquema de seguridad «${esquema}» no está en components.securitySchemes`, ubicaciones.get(`${metodo} ${path}`));
                    }
                }
            }
            if (operacion.operationId !== undefined) {
                if (operationIds.has(operacion.operationId)) {
                    error(`operationId «${operacion.operationId}» repetido`, ubicaciones.get(`${metodo} ${path}`));
                }
                operationIds.add(operacion.operationId);
            }
        }
    }

    comprobarRefs(doc, doc, "", error);

    return errores;
}

function comprobarRefs(raiz: IOpenAPI, nodo: unknown, ruta: string, error: (mensaje: string) => void): void {
    if (Array.isArray(nodo)) {
        nodo.forEach((hijo, i) => comprobarRefs(raiz, hijo, `${ruta}/${i}`, error));
    } else if (nodo !== null && typeof nodo === "object") {
        for (const [clave, hijo] of Object.entries(nodo)) {
            if (clave === "$ref" && typeof hijo === "string") {
                if (!resolverRef(raiz, hijo)) {
                    error(`$ref «${hijo}» sin resolver (en ${ruta === "" ? "/" : ruta})`);
                }
            } else {
                comprobarRefs(raiz, hijo, `${ruta}/${clave}`, error);
            }
        }
    }
}

function resolverRef(raiz: IOpenAPI, ref: string): boolean {
    if (!ref.startsWith("#/")) {
        return false;
    }
    let actual: unknown = raiz;
    for (const parte of ref.slice(2).split("/")) {
        if (actual === null || typeof actual !== "object" || !(parte in actual)) {
            return false;
        }
        actual = (actual as Record<string, unknown>)[parte];
    }

    return true;
}
