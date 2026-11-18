/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 16 Nov 2026 13:01:58 GMT
 * Hash: e1fc0261f6d2f025bddd6debe553a2f1
 * Versión: 2026.11.16+6-juancmartinez
 * Anterior: 2026.11.12+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {JSON_SCHEMA, load as yamlLoad} from "js-yaml";
import {lstat, readFile, realpath} from "node:fs/promises";
import path from "node:path";

/**
 * Entornos de los que se extrae topología (nombre del directorio overlay en el repo kustomize).
 */
export type TEntornoTopologia = "test" | "produccion";

/**
 * Topología de un deployment, tal como se guarda en `openapi_service.topology` (JSON). Es mutable y no forma
 * parte del documento versionado: no entra en el hash del contrato.
 *
 * @property v          - Versión del formato. Siempre `1`.
 * @property entorno    - Entorno del que sale (`test` | `produccion`).
 * @property kustomizer - Directorio del repo kustomize (`deploy.kustomize[].dir`, p. ej. `services`).
 * @property publico    - `hosts`: hosts públicos del borde, solo si el entorno aplica `router.json` **y** `_all` declara
 *                        `router.yaml` (si no, `[]`). `aplicaRouter` y `tieneRouter` son esas dos condiciones por separado.
 * @property interno    - `Service` del deployment en el clúster: `<servicio>.<namespace>.svc.cluster.local:<puerto>`.
 *                        `servicio` ya lleva el prefijo `proxy-servicio-` o `switch-servicio-` y el deployment.
 * @property alone      - El deployment solo se despliega en una zona.
 * @property soloZona   - Zona en la que se despliega si `alone` (si se conoce), si no `null`.
 */
export interface ITopologia {
    v: 1;
    entorno: TEntornoTopologia;
    kustomizer: string;
    publico: {hosts: string[], aplicaRouter: boolean, tieneRouter: boolean};
    interno: {servicio: string, namespace: string, puerto: 80};
    alone: boolean;
    soloZona: string | null;
}

/**
 * Resultado de calcular o leer una topología: la topología (o `null` si no se puede conocer) y los avisos.
 * Con `topologia: null` no se escribe nada y se conserva la anterior.
 */
export interface IResultadoTopologia {
    topologia: ITopologia | null;
    avisos: string[];
}

/**
 * Contenido (texto) de la lista cerrada de ficheros de kustomize que se leen. `undefined` = no existe.
 *
 * @property base    - `_all/kustomization.tmpl.yaml` o, si no existe, `_all/kustomization.yaml`.
 * @property entorno - `<entorno>/kustomization.yaml`.
 * @property router  - `<entorno>/router.json`.
 */
export interface IFicherosKustomize {
    base?: string;
    entorno?: string;
    router?: string;
}

/**
 * Datos de un deployment para calcular su topología.
 *
 * @property name       - Deployment (`deploy.kustomize[].name`).
 * @property kustomizer - Directorio del repo kustomize (`deploy.kustomize[].dir`).
 * @property entorno    - Entorno.
 * @property alone      - `deploy.alone`.
 * @property soloZona   - Zona de despliegue si `alone` y se conoce.
 */
export interface IConfigTopologia {
    name: string;
    kustomizer: string;
    entorno: TEntornoTopologia;
    alone: boolean;
    soloZona: string | null;
}

/**
 * Datos para leer la topología de un deployment del clon de kustomize.
 *
 * @property raiz     - Directorio del clon del repo kustomize.
 * @property dir      - `deploy.kustomize[].dir`.
 * @property name     - `deploy.kustomize[].name`.
 * @property entorno  - Entorno (`--env`).
 * @property alone    - `deploy.alone`.
 * @property soloZona - Zona de despliegue, si se conoce.
 */
export interface IConfigLeerTopologia {
    raiz: string;
    dir: string;
    name: string;
    entorno: string;
    alone: boolean;
    soloZona: string | null;
}

/** Entornos válidos. */
const ENTORNOS: readonly string[] = ["test", "produccion"];

/** Nombre de un deployment o de un directorio del repo kustomize. */
export const NOMBRE = /^[a-z0-9-]+$/;

/** Etiqueta DNS (namespace, zona). */
const ETIQUETA = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Host público: nombre DNS en minúsculas con al menos un punto; sin comodines, puerto ni `error` (las IP se rechazan aparte). */
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Última etiqueta numérica: una IPv4 (`10.0.0.1`) casa con {@link HOST}, un dominio real no acaba en número. */
const ETIQUETA_NUMERICA = /\.[0-9]+$/;

/** Etiqueta hexadecimal (`0x7f`): `new URL("https://0x7f.0x1")` la convierte en `127.0.0.1`. */
const ETIQUETA_HEXADECIMAL = /^0x/i;

/** Sufijos que solo resuelven dentro de una red interna. */
const SUFIJOS_INTERNOS: readonly string[] = [".svc", ".cluster.local", ".internal", ".local", ".localhost"];

/** Segmentos que nunca se aceptan como `dir` ni `name`: contienen secretos o basura de trabajo. */
export const SEGMENTOS_PROHIBIDOS: readonly string[] = ["tmp", "credenciales"];

/** Tamaño máximo de cada fichero leído (64 KiB). */
export const TAMANO_MAX = 64 * 1024;

/** Tope de hosts por deployment. */
const HOSTS_MAX = 50;

/**
 * Si `entorno` es uno de los entornos de los que se extrae topología.
 *
 * @param entorno - Valor de `--env`.
 */
export function esEntornoTopologia(entorno: string): entorno is TEntornoTopologia {
    return ENTORNOS.includes(entorno);
}

/**
 * Calcula la topología de un deployment a partir del contenido de sus ficheros de kustomize. Es pura: no toca el
 * disco ni registra nada. Si algo falta o no se entiende devuelve `topologia: null` con el motivo en `avisos`.
 *
 * - `namespace`, `nameSuffix` (tiene que ser `-<name>`), componente (`proxy` | `switch`) y `router.yaml` salen de `_all`.
 * - `aplicaRouter` sale del overlay del entorno (un `patches[]` con `path: router.json`).
 * - Los hosts públicos solo se leen de `router.json` si se aplica **y** `_all` declara `router.yaml` (si no, el
 *   parche no se aplica a ninguna `VirtualService`).
 *
 * @param config   - Deployment y entorno.
 * @param ficheros - Contenido de los ficheros.
 */
export function calcularTopologia({name, kustomizer, entorno, alone, soloZona}: IConfigTopologia, ficheros: IFicherosKustomize): IResultadoTopologia {
    const avisos: string[] = [];
    const sinTopologia = (motivo: string): IResultadoTopologia => ({topologia: null, avisos: [...avisos, `${name}: ${motivo}`]});

    if (ficheros.base === undefined) {
        return sinTopologia("no hay _all/kustomization(.tmpl).yaml");
    }
    const base = parsearYaml(ficheros.base);
    if (base === undefined) {
        return sinTopologia("_all/kustomization no es un YAML con un objeto");
    }

    const namespace = base["namespace"];
    if (typeof namespace !== "string" || !ETIQUETA.test(namespace)) {
        return sinTopologia("el namespace de _all/kustomization falta o no es un nombre fijo");
    }
    if (base["nameSuffix"] !== `-${name}`) {
        return sinTopologia(`el nameSuffix de _all/kustomization no es «-${name}»`);
    }

    const recursos = textos(base["resources"]);
    const componentes = new Set<string>();
    for (const recurso of recursos) {
        const coincide = /(?:^|\/)_componentes\/(proxy|switch)\/?$/.exec(recurso);
        if (coincide?.[1] !== undefined) {
            componentes.add(coincide[1]);
        }
    }
    const [componente, otro] = [...componentes];
    if (componente === undefined || otro !== undefined) {
        return sinTopologia("_all/kustomization no usa exactamente uno de los componentes proxy o switch");
    }
    const tieneRouter = declaraRouter(base);

    if (ficheros.entorno === undefined) {
        return sinTopologia(`no hay ${entorno}/kustomization.yaml`);
    }
    const overlay = parsearYaml(ficheros.entorno);
    if (overlay === undefined) {
        return sinTopologia(`${entorno}/kustomization.yaml no es un YAML con un objeto`);
    }
    const aplicaRouter = aplicaRouterJson(overlay);

    let hosts: string[] = [];
    if (aplicaRouter && tieneRouter) {
        if (ficheros.router === undefined) {
            return sinTopologia(`${entorno}/kustomization.yaml aplica router.json pero no existe`);
        }
        const leidos = leerHosts(ficheros.router);
        if (leidos === undefined) {
            return sinTopologia(`${entorno}/router.json no es un JSON de operaciones válido`);
        }
        hosts = leidos.validos;
        if (leidos.descartados > 0) {
            // Solo el número: el contenido de un host descartado puede ser cualquier cosa y no se registra.
            avisos.push(`${name}: ${leidos.descartados} host(s) descartado(s) en ${entorno}/router.json (no son un nombre DNS público)`);
        }
        if (hosts.length === 0) {
            avisos.push(`${name}: ${entorno}/router.json no tiene ningún host público válido`);
        }
    }

    const topologia: ITopologia = {
        v: 1,
        entorno,
        kustomizer,
        publico: {hosts, aplicaRouter, tieneRouter},
        interno: {servicio: `${componente}-servicio-${name}`, namespace, puerto: 80},
        alone,
        soloZona: alone ? soloZona : null,
    };

    return {topologia, avisos};
}

/**
 * Lee del clon de kustomize los ficheros de un deployment y calcula su topología ({@link calcularTopologia}).
 *
 * Solo se leen, con la ruta validada, `_all/kustomization.tmpl.yaml` (o `.yaml`), `<entorno>/kustomization.yaml` y
 * `<entorno>/router.json` (este solo si hace falta). Nunca se entra en `tmp/` ni en `credenciales/` (ni como `dir` ni como `name`), no se siguen
 * enlaces simbólicos, hay un tope de tamaño y el contenido no se registra.
 *
 * @param config - Clon, deployment y entorno.
 */
export async function leerTopologia({raiz, dir, name, entorno, alone, soloZona}: IConfigLeerTopologia): Promise<IResultadoTopologia> {
    const sinTopologia = (motivo: string): IResultadoTopologia => ({topologia: null, avisos: [`${name}: ${motivo}`]});
    if (!NOMBRE.test(dir) || !NOMBRE.test(name) || SEGMENTOS_PROHIBIDOS.includes(dir) || SEGMENTOS_PROHIBIDOS.includes(name)) {
        return sinTopologia("el nombre o el directorio de kustomize no son válidos");
    }
    if (!esEntornoTopologia(entorno)) {
        return sinTopologia(`el entorno «${entorno}» no es test ni produccion`);
    }

    let raizReal: string;
    let baseReal: string;
    try {
        raizReal = await realpath(raiz);
        baseReal = await realpath(path.join(raizReal, dir, name));
    } catch {
        return sinTopologia(`no existe ${dir}/${name} en el clon de kustomize`);
    }
    if (!dentro(raizReal, baseReal)) {
        return sinTopologia(`${dir}/${name} sale del clon de kustomize`);
    }

    const avisos: string[] = [];
    const leer = async (relativa: string): Promise<string | undefined> => {
        const resultado = await leerFichero(baseReal, relativa);
        if (resultado.aviso !== undefined) {
            avisos.push(`${name}: ${resultado.aviso}`);
        }

        return resultado.texto;
    };

    const ficheros: IFicherosKustomize = {
        base: await leer("_all/kustomization.tmpl.yaml") ?? await leer("_all/kustomization.yaml"),
        entorno: await leer(`${entorno}/kustomization.yaml`),
    };
    if (ficheros.base !== undefined && ficheros.entorno !== undefined && necesitaRouter(ficheros.base, ficheros.entorno)) {
        ficheros.router = await leer(`${entorno}/router.json`);
    }

    const resultado = calcularTopologia({name, kustomizer: dir, entorno, alone, soloZona}, ficheros);

    return {topologia: resultado.topologia, avisos: [...avisos, ...resultado.avisos]};
}

/**
 * Si un error de MySQL al escribir la topología significa que la base no la admite todavía: columna inexistente
 * (`ER_BAD_FIELD_ERROR`, DDL sin aplicar) o usuario sin permiso (`ER_COLUMNACCESS_DENIED_ERROR`,
 * `ER_TABLEACCESS_DENIED_ERROR`, `ER_DBACCESS_DENIED_ERROR`, falta el `GRANT`). En esos casos el autodoc sigue sin
 * topología; cualquier otro error se propaga.
 *
 * @param err - Error capturado.
 */
export function esTopologiaNoSoportada(err: unknown): boolean {
    const codigo = typeof err === "object" && err !== null ? (err as {code?: unknown}).code : undefined;

    return codigo === "ER_BAD_FIELD_ERROR" || codigo === "ER_COLUMNACCESS_DENIED_ERROR" || codigo === "ER_TABLEACCESS_DENIED_ERROR" || codigo === "ER_DBACCESS_DENIED_ERROR";
}

/**
 * Zona de despliegue del primer clúster de `entornos.json` (`[0].resourceLabels.zona`), que es en el que se
 * despliegan los `alone`. `null` si no se puede saber.
 *
 * @param contenido - Texto de `entornos.json`.
 */
export function zonaDeEntornos(contenido: string): string | null {
    try {
        const primero = (JSON.parse(contenido) as unknown);
        const etiquetas = Array.isArray(primero) && esObjeto(primero[0]) && esObjeto(primero[0]["resourceLabels"]) ? primero[0]["resourceLabels"] : undefined;
        const zona = etiquetas?.["zona"];

        return typeof zona === "string" && ETIQUETA.test(zona) ? zona : null;
    } catch {
        return null;
    }
}

/**
 * Si `_all` declara `router.yaml` entre sus `resources`.
 */
function declaraRouter(base: Record<string, unknown>): boolean {
    return textos(base["resources"]).some(r => r === "router.yaml" || r === "./router.yaml");
}

/**
 * Si el overlay del entorno aplica `router.json` como parche.
 */
function aplicaRouterJson(overlay: Record<string, unknown>): boolean {
    const parches = Array.isArray(overlay["patches"]) ? overlay["patches"] as unknown[] : [];

    return parches.some(p => esObjeto(p) && (p["path"] === "router.json" || p["path"] === "./router.json"));
}

/**
 * Si, con estos dos ficheros, hay que leer `router.json` (se aplica y `_all` declara `router.yaml`).
 */
function necesitaRouter(base: string, entorno: string): boolean {
    const b = parsearYaml(base);
    const o = parsearYaml(entorno);

    return b !== undefined && o !== undefined && declaraRouter(b) && aplicaRouterJson(o);
}

/**
 * Si el texto vale como host público: nombre DNS en minúsculas, sin ser una IP (ni una etiqueta `0x…`, ni algo que `new URL` convierta en un literal IP), sin sufijo de red
 * interna y distinto de `error`.
 */
function esHostPublico(host: string): boolean {
    if (host.length > 253 || !HOST.test(host) || ETIQUETA_NUMERICA.test(host) || host === "error") {
        return false;
    }
    if (host.split(".").some(etiqueta => ETIQUETA_HEXADECIMAL.test(etiqueta)) || SUFIJOS_INTERNOS.some(sufijo => host.endsWith(sufijo))) {
        return false;
    }
    try {
        const {hostname} = new URL(`https://${host}`);

        return hostname === host && !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    } catch {
        return false;
    }
}

/**
 * Hosts de las operaciones `replace` sobre `/spec/hosts` de un `router.json`. `undefined` si no es un array de
 * objetos JSON.
 */
function leerHosts(texto: string): {validos: string[], descartados: number} | undefined {
    let json: unknown;
    try {
        json = JSON.parse(texto);
    } catch {
        return undefined;
    }
    if (!Array.isArray(json)) {
        return undefined;
    }

    const validos: string[] = [];
    let descartados = 0;
    for (const operacion of json as unknown[]) {
        if (!esObjeto(operacion) || operacion["op"] !== "replace" || operacion["path"] !== "/spec/hosts" || !Array.isArray(operacion["value"])) {
            continue;
        }
        for (const host of operacion["value"] as unknown[]) {
            if (typeof host === "string" && esHostPublico(host)) {
                if (!validos.includes(host) && validos.length < HOSTS_MAX) {
                    validos.push(host);
                }
            } else {
                descartados += 1;
            }
        }
    }

    return {validos, descartados};
}

/**
 * Lee un fichero de la lista cerrada dentro de `base`: sin enlaces simbólicos, que sea un fichero normal,
 * dentro de `base` y de no más de {@link TAMANO_MAX}.
 */
async function leerFichero(base: string, relativa: string): Promise<{texto?: string, aviso?: string}> {
    const ruta = path.join(base, relativa);
    try {
        const info = await lstat(ruta);
        if (!info.isFile()) {
            return {aviso: `${relativa} no es un fichero normal (¿enlace simbólico?), no se lee`};
        }
        if (info.size > TAMANO_MAX) {
            return {aviso: `${relativa} ocupa más de ${TAMANO_MAX / 1024} KiB, no se lee`};
        }
        if (!dentro(base, await realpath(ruta))) {
            return {aviso: `${relativa} sale del directorio del deployment, no se lee`};
        }

        return {texto: await readFile(ruta, "utf8")};
    } catch (err) {
        const codigo = (err as {code?: unknown}).code;
        if (codigo === "ENOENT" || codigo === "ENOTDIR") {
            return {};
        }

        return {aviso: `no se puede leer ${relativa} (${typeof codigo === "string" ? codigo : "error"})`};
    }
}

export function dentro(raiz: string, ruta: string): boolean {
    return ruta === raiz || ruta.startsWith(raiz.endsWith(path.sep) ? raiz : `${raiz}${path.sep}`);
}

export function parsearYaml(texto: string): Record<string, unknown> | undefined {
    try {
        const valor = yamlLoad(texto, {schema: JSON_SCHEMA}) as unknown;

        return esObjeto(valor) ? valor : undefined;
    } catch {
        return undefined;
    }
}

export function textos(valor: unknown): string[] {
    return Array.isArray(valor) ? (valor as unknown[]).filter((v): v is string => typeof v === "string") : [];
}

export function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
