/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 16 Nov 2026 13:01:58 GMT
 * Hash: 60bb919f952cb573bde9344b325fc791
 * Versión: 2026.11.16+6-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {JSON_SCHEMA, load as yamlLoad} from "js-yaml";
import {lstat, readFile, realpath} from "node:fs/promises";
import path from "node:path";

import {NOMBRE, SEGMENTOS_PROHIBIDOS, TAMANO_MAX, dentro, esEntornoTopologia, esObjeto, esTopologiaNoSoportada, parsearYaml, textos} from "./topologia";

/**
 * Resultado de resolver el departamento de un deployment: el `dpto` (o `null` si no se puede conocer con certeza) y
 * los avisos. Con `dpto: null` el autodoc escribe `NULL` en `openapi_service.dpto`: ante la duda, el servicio no
 * pertenece a ningún departamento y nadie ve su documentación interna.
 */
export interface IResultadoDepartamento {
    dpto: string | null;
    avisos: string[];
}

/**
 * Nodo de la cadena de kustomizations que se leen para resolver el departamento: el overlay del entorno, `_all` y los
 * componentes a los que apuntan sus `resources`.
 *
 * @property ruta     - Ruta relativa al clon de kustomize (solo para los avisos).
 * @property texto    - Contenido de `kustomization.tmpl.yaml` o, si no existe, de `kustomization.yaml`.
 * @property ficheros - Contenido de los parches con `path` que pueden afectar a la etiqueta, por el `path` tal cual
 *                      está escrito en la kustomization. Falta el que no se ha podido leer.
 * @property hijos    - Nodos de los `resources`/`components` que son directorios, por su valor tal cual está escrito.
 *                      Falta el que no se ha podido leer (fuera del clon, enlace simbólico, ciclo, demasiado profundo…).
 * @property archivos - `resources` que son ficheros normales (manifiestos, `router.yaml`…): no se interpretan.
 */
export interface INodoKustomize {
    ruta: string;
    texto: string;
    ficheros: Record<string, string>;
    hijos: Record<string, INodoKustomize>;
    archivos: string[];
}

/**
 * Entrada de `patches[]` de una kustomization.
 *
 * @property path   - Fichero del parche.
 * @property patch  - Parche en línea.
 * @property target - `target` del parche.
 */
export interface IParcheKustomize {
    path?: string;
    patch?: string;
    target?: Record<string, unknown>;
}

/**
 * Lo que interesa de una kustomization para resolver el departamento.
 *
 * @property recursos - `resources` y `components`, en orden.
 * @property parches  - `patches[]`, en orden.
 * @property dudas    - Motivos por los que no se puede asegurar el departamento (formas que no se interpretan).
 */
export interface IKustomizacion {
    recursos: string[];
    parches: IParcheKustomize[];
    dudas: string[];
}

/**
 * Efecto de un parche sobre la etiqueta `dpto`: el valor que fija (si fija alguno) o el motivo de la duda.
 */
export interface IEfectoParche {
    valor?: string;
    duda?: string;
}

/**
 * Datos para leer el departamento de un deployment del clon de kustomize.
 *
 * @property raiz    - Directorio del clon del repo kustomize.
 * @property dir     - `deploy.kustomize[].dir`.
 * @property name    - `deploy.kustomize[].name`.
 * @property entorno - Entorno (`test` | `produccion`).
 */
export interface IConfigLeerDepartamento {
    raiz: string;
    dir: string;
    name: string;
    entorno: string;
}

/**
 * Lo único que hace falta de una transacción de MySQL para escribir el departamento.
 */
export interface IEscritorSql {
    update(sql: string, params: (string | number | null)[]): Promise<unknown>;
}

/**
 * Resultado de {@link escribirDepartamento}.
 *
 * @property guardado   - Se ha ejecutado el `UPDATE` (con un valor o con `NULL`).
 * @property sinSoporte - La base no admite el departamento (sin columna o sin `GRANT`): no se ha escrito.
 */
export interface IResultadoEscrituraDepartamento {
    guardado: boolean;
    sinSoporte: boolean;
}

/**
 * Valor admitido para el departamento, acotado por la columna `openapi_service.dpto` (`VARCHAR(32)`). El acceso por
 * departamento de API Docs (BAK-1810) lo repite en `DPTO_REGEX` de `services-comun-meteored` y en el `CHECK` de
 * `department.id`: tiene que ser el mismo en todos. Se duplica aquí a propósito: `@mr/cli` llega a todos los monorepos y
 * no puede depender de `services-comun-meteored`.
 */
const DPTO = /^[a-z0-9-]{1,32}$/;

/** Ruta de la etiqueta en un `Deployment` (y en un `Job`). */
const RUTA_DPTO_POD = "/spec/template/metadata/labels/dpto";

/** Ruta de la etiqueta en un `CronJob`. */
const RUTA_DPTO_CRONJOB = "/spec/jobTemplate/spec/template/metadata/labels/dpto";

const RUTAS_DPTO: readonly string[] = [RUTA_DPTO_POD, RUTA_DPTO_CRONJOB];

/** Recursos con pods, los únicos a los que un parche puede poner la etiqueta que nos interesa. */
const KINDS_CON_POD: readonly string[] = ["Deployment", "CronJob", "Job"];

/** Claves de una kustomization que pueden tocar etiquetas por una vía que no se interpreta. */
const CLAVES_NO_INTERPRETADAS: readonly string[] = ["patchesStrategicMerge", "patchesJson6902", "replacements", "transformers"];

/** Niveles máximos de kustomizations anidadas (overlay → `_all` → componente → componente base, con holgura). */
const PROFUNDIDAD_MAX = 5;

/** Tope de kustomizations leídas por deployment. */
const NODOS_MAX = 40;

/**
 * Si el valor sirve como departamento (`^[a-z0-9-]{1,32}$`).
 *
 * @param valor - Valor a comprobar.
 */
export function esDepartamentoValido(valor: unknown): valor is string {
    return typeof valor === "string" && DPTO.test(valor);
}

/**
 * Si un error de MySQL al escribir `dpto` significa que la base no lo admite todavía: columna inexistente (DDL sin
 * aplicar) o usuario sin permiso (falta el `GRANT`). En esos casos el autodoc sigue sin `dpto`; cualquier otro error
 * se propaga.
 *
 * @param err - Error capturado.
 */
export function esDepartamentoNoSoportado(err: unknown): boolean {
    return esTopologiaNoSoportada(err);
}

/**
 * Escribe `openapi_service.dpto` de un servicio dentro de la transacción del documento, con su propio `UPDATE` (así
 * una base sin la columna de topología no impide escribir el departamento, ni al revés).
 *
 * - `undefined`: no se ha intentado resolver el departamento (sin clon de kustomize…): no se toca nada.
 * - `null`: se ha intentado y no se sabe con certeza: se escribe `NULL`, de modo que un servicio que cambia de
 *   departamento y cuya kustomization ya no se interpreta no conserva el departamento viejo.
 * - Si la base no lo admite (columna inexistente o falta el `GRANT`, {@link esDepartamentoNoSoportado}) no se escribe y
 *   se informa en `sinSoporte`: un `UPDATE` fallido no aborta la transacción en MySQL. Cualquier otro error se propaga.
 *
 * @param transaccion - Transacción abierta.
 * @param servicioId  - `openapi_service.id`.
 * @param dpto        - Departamento, `null` o `undefined`.
 */
export async function escribirDepartamento(transaccion: IEscritorSql, servicioId: number, dpto: string | null | undefined): Promise<IResultadoEscrituraDepartamento> {
    if (dpto === undefined) {
        return {guardado: false, sinSoporte: false};
    }
    try {
        await transaccion.update("UPDATE openapi_service SET dpto = ? WHERE id = ?", [dpto, servicioId]);
    } catch (err) {
        if (!esDepartamentoNoSoportado(err)) {
            throw err;
        }

        return {guardado: false, sinSoporte: true};
    }

    return {guardado: true, sinSoporte: false};
}

/**
 * Departamento de un deployment que se despliega como lambda (Cloud Run): `deploy.lambda.labels.dpto` del
 * `mrpack.json`. Si falta o no cumple el formato, `null`.
 *
 * @param name - Deployment.
 * @param dpto - `deploy.lambda.labels.dpto`.
 */
export function departamentoDeLambda(name: string, dpto: unknown): IResultadoDepartamento {
    if (dpto === undefined) {
        return {dpto: null, avisos: [`${name}: deploy.lambda.labels.dpto no está declarado`]};
    }
    if (!esDepartamentoValido(dpto)) {
        return {dpto: null, avisos: [`${name}: deploy.lambda.labels.dpto no cumple ${DPTO.source}`]};
    }

    return {dpto, avisos: []};
}

/**
 * Interpreta una kustomization: sus `resources` y `components`, sus `patches[]` y las formas que no se pueden
 * interpretar (`labels`/`commonLabels` con `dpto`, `patchesStrategicMerge`, `patchesJson6902`, `replacements`,
 * `transformers`). Pura. `undefined` si no es un YAML con un objeto.
 *
 * @param texto - Contenido de la kustomization.
 */
export function interpretarKustomizacion(texto: string): IKustomizacion | undefined {
    const raiz = parsearYaml(texto);
    if (raiz === undefined) {
        return undefined;
    }

    const dudas: string[] = [];
    const recursos: string[] = [];
    for (const clave of ["resources", "components"]) {
        const valor = raiz[clave];
        if (valor === undefined) {
            continue;
        }
        const lista = textos(valor);
        if (!Array.isArray(valor) || lista.length !== valor.length) {
            dudas.push(`${clave} no es una lista de rutas`);
        }
        recursos.push(...lista);
    }

    const parches: IParcheKustomize[] = [];
    const patches = raiz["patches"];
    if (patches !== undefined && !Array.isArray(patches)) {
        dudas.push("patches no es una lista");
    }
    for (const entrada of Array.isArray(patches) ? patches as unknown[] : []) {
        if (!esObjeto(entrada) || (entrada["path"] === undefined) === (entrada["patch"] === undefined)
            || (entrada["path"] !== undefined && typeof entrada["path"] !== "string")
            || (entrada["patch"] !== undefined && typeof entrada["patch"] !== "string")
            || (entrada["target"] !== undefined && !esObjeto(entrada["target"]))) {
            dudas.push("una entrada de patches no tiene la forma {path|patch, target}");
            continue;
        }
        parches.push({
            path: entrada["path"] as string | undefined,
            patch: entrada["patch"] as string | undefined,
            target: entrada["target"] as Record<string, unknown> | undefined,
        });
    }

    for (const clave of CLAVES_NO_INTERPRETADAS) {
        if (raiz[clave] !== undefined) {
            dudas.push(`usa ${clave}, que no se interpreta`);
        }
    }
    const comunes = raiz["commonLabels"];
    if (comunes !== undefined && (!esObjeto(comunes) || "dpto" in comunes)) {
        dudas.push("commonLabels pone o puede poner dpto");
    }
    const labels = raiz["labels"];
    if (labels !== undefined && !Array.isArray(labels)) {
        dudas.push("labels no es una lista");
    }
    for (const entrada of Array.isArray(labels) ? labels as unknown[] : []) {
        const pares = esObjeto(entrada) ? entrada["pairs"] : undefined;
        if (!esObjeto(entrada) || (pares !== undefined && !esObjeto(pares))) {
            dudas.push("una entrada de labels no tiene la forma {pairs}");
        } else if (esObjeto(pares) && "dpto" in pares) {
            dudas.push("labels pone dpto");
        }
    }

    return {recursos, parches, dudas};
}

/**
 * Si un parche puede afectar a la etiqueta: sin `target.kind` (se aplica a todo) o con un `kind` que lleva pods.
 * Los parches a `HorizontalPodAutoscaler`, `VirtualService`… ni se leen.
 *
 * @param parche - Entrada de `patches[]`.
 */
export function esParcheRelevante(parche: IParcheKustomize): boolean {
    const kind = parche.target?.["kind"];

    return kind === undefined || typeof kind !== "string" || KINDS_CON_POD.includes(kind);
}

/**
 * Efecto de un parche sobre la etiqueta `dpto`. Puro.
 *
 * - JSON6902 (lista de operaciones, en JSON o YAML): la última `add`/`replace` sobre `…/labels/dpto` con un valor que
 *   cumple el formato fija el valor.
 * - Es duda: un valor que no cumple el formato; un `remove`, `move` o `copy` que toque la etiqueta o alguno de sus
 *   padres (`/spec/template/metadata/labels`…) o hijos; un `add`/`replace` sobre uno de sus padres; un `target` con
 *   algo más que `kind` (nombre, selectores…); y un parche que no sea JSON6902 pero mencione `dpto` (*strategic merge*).
 *
 * @param texto    - Contenido del parche.
 * @param objetivo - `target` de la entrada de `patches[]`.
 */
export function efectoDeParche(texto: string, objetivo?: Record<string, unknown>): IEfectoParche {
    const operaciones = parsearOperaciones(texto);
    if (operaciones === undefined) {
        return texto.includes("dpto") ? {duda: "un parche que no es JSON6902 menciona dpto"} : {};
    }

    let valor: string | undefined;
    let tocado = false;
    for (const operacion of operaciones) {
        const destino = typeof operacion["path"] === "string" ? operacion["path"] : undefined;
        const origen = typeof operacion["from"] === "string" ? operacion["from"] : undefined;
        const op = operacion["op"];
        if (op === "test") {
            continue;
        }
        const tocaOrigen = origen !== undefined && tocaRuta(origen);
        if (destino === undefined || !tocaRuta(destino)) {
            if (tocaOrigen) {
                return {duda: `una operación ${String(op)} toma la etiqueta dpto de su sitio`};
            }
            continue;
        }
        tocado = true;
        if ((op === "add" || op === "replace") && RUTAS_DPTO.includes(destino)) {
            if (!esDepartamentoValido(operacion["value"])) {
                return {duda: `el valor de dpto no cumple ${DPTO.source}`};
            }
            valor = operacion["value"];
        } else {
            return {duda: `una operación ${String(op)} toca dpto o alguno de sus padres`};
        }
    }

    if (tocado && objetivo !== undefined && Object.keys(objetivo).some(clave => clave !== "kind")) {
        return {duda: "un parche que toca dpto tiene un target con selectores"};
    }

    return valor === undefined ? {} : {valor};
}

/**
 * Resuelve el departamento de un deployment a partir de la cadena de kustomizations ya leída (overlay del entorno →
 * `_all` → componentes). Pura.
 *
 * Kustomize aplica primero los `resources` de una kustomization y después sus propios `patches`, en orden, así que
 * el valor final es el del último parche que lo fija (el servicio sobrescribe al componente). Dos `resources` con
 * valores distintos, o cualquier cosa que no se interprete, dan `null`.
 *
 * @param name - Deployment (para los avisos).
 * @param raiz - Kustomization de partida, o `undefined` si no se ha podido leer.
 */
export function calcularDepartamento(name: string, raiz: INodoKustomize | undefined): IResultadoDepartamento {
    if (raiz === undefined) {
        return {dpto: null, avisos: [`${name}: no se ha podido leer la kustomization del entorno`]};
    }

    const {valor, dudas} = evaluar(raiz);
    if (dudas.length > 0) {
        return {dpto: null, avisos: dudas.map(duda => `${name}: ${duda}`)};
    }
    if (valor === undefined) {
        return {dpto: null, avisos: [`${name}: ninguna kustomization pone la etiqueta dpto`]};
    }

    return {dpto: valor, avisos: []};
}

/**
 * Lee del clon de kustomize la cadena de kustomizations de un deployment y resuelve su departamento
 * ({@link calcularDepartamento}).
 *
 * Parte de `<dir>/<name>/<entorno>/` y sigue sus `resources` y `components` que sean directorios (`../_all`, el
 * componente del kustomizer, los componentes base…). Solo se leen `kustomization.tmpl.yaml` (o `.yaml`) y los parches
 * de recursos con pods. Cada ruta se valida: dentro del clon, sin enlaces simbólicos en ningún tramo, sin `tmp/` ni
 * `credenciales/`, ficheros de no más de 64 KiB, un máximo de profundidad y de nodos y sin ciclos. El contenido de los
 * ficheros no se registra.
 *
 * @param config - Clon, deployment y entorno.
 */
export async function leerDepartamento({raiz, dir, name, entorno}: IConfigLeerDepartamento): Promise<IResultadoDepartamento> {
    const sinDpto = (motivo: string): IResultadoDepartamento => ({dpto: null, avisos: [`${name}: ${motivo}`]});
    if (!NOMBRE.test(dir) || !NOMBRE.test(name) || SEGMENTOS_PROHIBIDOS.includes(dir) || SEGMENTOS_PROHIBIDOS.includes(name)) {
        return sinDpto("el nombre o el directorio de kustomize no son válidos");
    }
    if (!esEntornoTopologia(entorno)) {
        return sinDpto(`el entorno «${entorno}» no es test ni produccion`);
    }

    let raizReal: string;
    try {
        raizReal = await realpath(raiz);
    } catch {
        return sinDpto("no existe el clon de kustomize");
    }

    const lector = new LectorKustomize(raizReal);

    return calcularDepartamento(name, await lector.leerNodo(path.join(raizReal, dir, name, entorno), 0));
}

class LectorKustomize {
    /* INSTANCE */

    private readonly raiz: string;
    private readonly enCurso: Set<string>;
    private leidos: number;

    public constructor(raiz: string) {
        this.raiz = raiz;
        this.enCurso = new Set();
        this.leidos = 0;
    }

    /**
     * Lee la kustomization de un directorio y, recursivamente, las de sus `resources` que son directorios.
     */
    public async leerNodo(dir: string, profundidad: number): Promise<INodoKustomize | undefined> {
        if (profundidad > PROFUNDIDAD_MAX || this.leidos >= NODOS_MAX || this.enCurso.has(dir) || await this.tipo(dir) !== "directorio") {
            return undefined;
        }
        const texto = await this.leerTexto(path.join(dir, "kustomization.tmpl.yaml")) ?? await this.leerTexto(path.join(dir, "kustomization.yaml"));
        if (texto === undefined) {
            return undefined;
        }
        this.leidos += 1;

        const nodo: INodoKustomize = {ruta: path.relative(this.raiz, dir), texto, ficheros: {}, hijos: {}, archivos: []};
        const kustomizacion = interpretarKustomizacion(texto);
        if (kustomizacion === undefined) {
            return nodo;
        }

        this.enCurso.add(dir);
        try {
            for (const recurso of kustomizacion.recursos) {
                const ruta = path.resolve(dir, recurso);
                const tipo = recurso.includes("://") ? undefined : await this.tipo(ruta);
                if (tipo === "fichero") {
                    nodo.archivos.push(recurso);
                } else if (tipo === "directorio") {
                    const hijo = await this.leerNodo(ruta, profundidad + 1);
                    if (hijo !== undefined) {
                        nodo.hijos[recurso] = hijo;
                    }
                }
            }
            for (const parche of kustomizacion.parches) {
                if (parche.path !== undefined && esParcheRelevante(parche)) {
                    const contenido = await this.leerTexto(path.resolve(dir, parche.path));
                    if (contenido !== undefined) {
                        nodo.ficheros[parche.path] = contenido;
                    }
                }
            }
        } finally {
            this.enCurso.delete(dir);
        }

        return nodo;
    }

    /**
     * Qué es la ruta, si se puede leer con seguridad: dentro del clon, sin `tmp/` ni `credenciales/` y sin enlaces
     * simbólicos en ningún tramo (la ruta real coincide con la pedida). `undefined` si no existe o no es segura.
     */
    private async tipo(ruta: string): Promise<"directorio" | "fichero" | undefined> {
        if (!dentro(this.raiz, ruta) || path.relative(this.raiz, ruta).split(path.sep).some(segmento => SEGMENTOS_PROHIBIDOS.includes(segmento))) {
            return undefined;
        }
        try {
            const info = await lstat(ruta);
            if (info.isSymbolicLink() || await realpath(ruta) !== ruta) {
                return undefined;
            }

            return info.isDirectory() ? "directorio" : info.isFile() ? "fichero" : undefined;
        } catch {
            return undefined;
        }
    }

    private async leerTexto(ruta: string): Promise<string | undefined> {
        try {
            if (await this.tipo(ruta) !== "fichero" || (await lstat(ruta)).size > TAMANO_MAX) {
                return undefined;
            }

            return await readFile(ruta, "utf8");
        } catch {
            return undefined;
        }
    }
}

interface IEstado {
    valor?: string;
    dudas: string[];
}

function evaluar(nodo: INodoKustomize): IEstado {
    const kustomizacion = interpretarKustomizacion(nodo.texto);
    if (kustomizacion === undefined) {
        return {dudas: [`${nodo.ruta}: no es un YAML con un objeto`]};
    }

    const dudas = kustomizacion.dudas.map(duda => `${nodo.ruta}: ${duda}`);
    let valor: string | undefined;
    for (const recurso of kustomizacion.recursos) {
        const hijo = nodo.hijos[recurso];
        if (hijo === undefined) {
            if (!nodo.archivos.includes(recurso)) {
                dudas.push(`${nodo.ruta}: no se ha podido leer el recurso «${nombreSeguro(recurso)}»`);
            }
            continue;
        }
        const estado = evaluar(hijo);
        dudas.push(...estado.dudas);
        if (estado.valor === undefined) {
            continue;
        }
        if (valor !== undefined && valor !== estado.valor) {
            dudas.push(`${nodo.ruta}: dos recursos fijan departamentos distintos`);
        }
        valor = estado.valor;
    }

    for (const parche of kustomizacion.parches) {
        if (!esParcheRelevante(parche)) {
            continue;
        }
        const contenido = parche.patch ?? (parche.path === undefined ? undefined : nodo.ficheros[parche.path]);
        if (contenido === undefined) {
            dudas.push(`${nodo.ruta}: no se ha podido leer el parche «${nombreSeguro(parche.path ?? "")}»`);
            continue;
        }
        const efecto = efectoDeParche(contenido, parche.target);
        if (efecto.duda !== undefined) {
            dudas.push(`${nodo.ruta}: ${efecto.duda}`);
        } else if (efecto.valor !== undefined) {
            valor = efecto.valor;
        }
    }

    return {valor, dudas};
}

/**
 * Operaciones JSON6902 de un parche (en JSON o YAML), o `undefined` si no es una lista de operaciones.
 */
function parsearOperaciones(texto: string): Record<string, unknown>[] | undefined {
    let valor: unknown;
    try {
        valor = yamlLoad(texto, {schema: JSON_SCHEMA});
    } catch {
        return undefined;
    }
    if (!Array.isArray(valor) || !(valor as unknown[]).every(operacion => esObjeto(operacion) && typeof operacion["op"] === "string")) {
        return undefined;
    }

    return valor as Record<string, unknown>[];
}

/**
 * Si la ruta JSON Pointer es la de la etiqueta, uno de sus padres o uno de sus hijos.
 */
function tocaRuta(ruta: string): boolean {
    return RUTAS_DPTO.some(dpto => ruta === dpto || dpto.startsWith(`${ruta}/`) || ruta.startsWith(`${dpto}/`));
}

/**
 * Un nombre de fichero para un aviso: solo si tiene el aspecto de una ruta; si no, un marcador.
 */
function nombreSeguro(nombre: string): string {
    return /^[\w./@-]{1,120}$/.test(nombre) ? nombre : "…";
}
