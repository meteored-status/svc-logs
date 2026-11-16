/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: e6e001f3830703d85afda2c740f005e5
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {createHash} from "node:crypto";

/**
 * Resultado de calcular las bajas de una ejecución.
 *
 * @property bajas - Deployments registrados que hay que marcar como retirados.
 * @property aviso - Por qué no se marca ninguna baja, si es el caso.
 */
export interface IBajas {
    bajas: string[];
    aviso?: string;
}

/**
 * Datos para calcular las bajas.
 *
 * @property vigentes    - Deployments que declaran los `mrpack.json` del repositorio.
 * @property registrados - Deployments del repositorio que están en la base sin marca de baja.
 * @property completo    - Todos los `mrpack.json` se han podido leer.
 * @property filtrado    - La ejecución se limitó a un servicio (`--servicio`).
 */
export interface IConfigBajas {
    vigentes: ReadonlySet<string>;
    registrados: string[];
    completo: boolean;
    filtrado: boolean;
}

/**
 * Forma canónica de un valor JSON: las claves de los objetos van ordenadas, recursivamente, y los arrays
 * conservan su orden. Dos documentos iguales en contenido dan el mismo texto aunque sus claves vengan en otro orden.
 *
 * @param valor - Valor JSON.
 */
export function canonico(valor: unknown): string {
    if (Array.isArray(valor)) {
        return `[${valor.map(v => canonico(v === undefined ? null : v)).join(",")}]`;
    }
    if (valor !== null && typeof valor === "object") {
        const objeto = valor as Record<string, unknown>;
        const claves = Object.keys(objeto).filter(k => objeto[k] !== undefined).sort();

        return `{${claves.map(k => `${JSON.stringify(k)}:${canonico(objeto[k])}`).join(",")}}`;
    }

    return JSON.stringify(valor) ?? "null";
}

/**
 * Hash (SHA-256 hexadecimal) de un documento en su forma canónica. Se calcula siempre sobre el documento generado
 * en Node, nunca sobre lo que devuelve MySQL, cuyo tipo JSON reordena las claves.
 *
 * @param doc - Documento.
 */
export function hashDocumento(doc: unknown): string {
    return createHash("sha256").update(canonico(doc)).digest("hex");
}

/**
 * Si un error de MySQL es una carrera con otro guardado concurrente que merece un reintento: clave duplicada
 * (`ER_DUP_ENTRY`) o interbloqueo (`ER_LOCK_DEADLOCK`).
 *
 * @param err - Error capturado.
 */
export function esReintentable(err: unknown): boolean {
    const codigo = typeof err === "object" && err !== null ? (err as {code?: unknown}).code : undefined;

    return codigo === "ER_DUP_ENTRY" || codigo === "ER_LOCK_DEADLOCK";
}

/**
 * Si hay que crear una versión nueva: no hay versión vigente o su hash es otro.
 *
 * @param actual - Hash de la versión vigente, si hay.
 * @param nuevo  - Hash del documento recién generado.
 */
export function necesitaVersion(actual: string | undefined | null, nuevo: string): boolean {
    return actual === undefined || actual === null || actual !== nuevo;
}

/**
 * Deployments que hay que dar de baja: los registrados que ya no declara ningún `mrpack.json`. No se da de baja
 * ninguno si algún manifest no se pudo leer (no se sabe qué sigue vigente) ni si la ejecución se limitó a un servicio.
 *
 * @param config - Vigentes, registrados y condiciones de la ejecución.
 */
export function calcularBajas({vigentes, registrados, completo, filtrado}: IConfigBajas): IBajas {
    if (filtrado) {
        return {bajas: [], aviso: "ejecución con --servicio: no se marca ninguna baja"};
    }
    if (!completo) {
        return {bajas: [], aviso: "algún mrpack.json no se ha podido leer: no se marca ninguna baja"};
    }

    return {bajas: registrados.filter(d => !vigentes.has(d))};
}

/**
 * Repositorio como `propietario/nombre`, sin esquema, servidor, credenciales ni `.git`. Acepta URL `https://`
 * (con o sin `usuario:token@`), `git@servidor:propietario/nombre.git` y el propio `propietario/nombre`.
 *
 * @param valor - Texto de la variable de entorno o salida de `git remote get-url`.
 * @returns El nombre normalizado, o `undefined` si no tiene la forma `propietario/nombre`.
 */
export function normalizarRepositorio(valor: string): string | undefined {
    let resto = valor.trim().replace(/\.git$/, "").replace(/\/+$/, "");
    resto = resto.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    // `usuario[:token]@` delante del servidor
    resto = resto.replace(/^[^/@]*@/, "");
    // `servidor:` (scp) o `servidor/` delante de `propietario/nombre`
    resto = resto.replace(/^[^/:]+[:/](?=[^/]+\/[^/]+$)/, "");
    if (!/^[^/\s:@]+\/[^/\s:@]+$/.test(resto)) {
        return undefined;
    }

    return resto;
}

/**
 * Pasa las credenciales de MySQL a un socket Unix, igual que hace `mrpack deploy` al preparar las credenciales de
 * un workspace: cambia el `socketPath` de `master`, de cada `slave` y el de las credenciales planas.
 *
 * @param credenciales - Contenido ya leído de `mysql-services-socket-<env>.json`.
 * @param socket       - Ruta del socket dentro del contenedor.
 * @returns Una copia con el socket cambiado.
 */
export function aplicarSocket(credenciales: unknown, socket: string): unknown {
    const json = JSON.parse(JSON.stringify(credenciales)) as {master?: {socketPath?: string}, slaves?: {socketPath?: string}[], socketPath?: string};
    if (json.master !== undefined) {
        json.master.socketPath = socket;
        if (!Array.isArray(json.slaves)) {
            json.slaves = [json.master];
        } else {
            for (const actual of json.slaves) {
                actual.socketPath = socket;
            }
        }
    } else if (Array.isArray(json.slaves)) {
        for (const actual of json.slaves) {
            actual.socketPath = socket;
        }
    }
    // Credenciales planas: el socket se pide expresamente, así que se pone aunque el fichero no lo trajera.
    if (json.socketPath !== undefined || (json.master === undefined && !Array.isArray(json.slaves))) {
        json.socketPath = socket;
    }

    return json;
}
