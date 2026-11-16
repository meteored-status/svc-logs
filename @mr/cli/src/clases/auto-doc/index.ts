/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 13:17:55 GMT
 * Hash: b7354bc5e7e1b79d97f83a06a93cd63b
 * Versión: 2026.11.12+2-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

import {isDir, isFile, readDir, readFileString} from "@mr/core-cli/fs";
import type {IOpenAPI} from "services-comun/modules/openapi/interface";

import {type IAviso, formatearAviso} from "./avisos";
import {type IDocumentoServicio, guardarDocumentos} from "./almacen";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";
import {construirOpenAPI} from "./openapi";
import {crearPrograma} from "./programa";
import {extraerRutas} from "./rutas";
import {type ITopologia, esEntornoTopologia, leerTopologia, zonaDeEntornos} from "./topologia";
import {validarOpenAPI} from "./validar";

/**
 * Configuración de una ejecución de `mrpack autodoc`.
 *
 * @property env      - Entorno de las credenciales de MySQL. Solo hace falta si se escribe en MySQL.
 * @property out      - Directorio donde escribir `<deployment>.openapi.json` en vez de usar MySQL.
 * @property dryRun   - Genera y valida sin escribir ni en MySQL ni en disco.
 * @property servicio - Limita la generación a un workspace de `services/`.
 * @property strict   - Los avisos hacen fallar la generación del servicio.
 */
export interface IConfigEjecucion {
    env?: string;
    out?: string;
    dryRun?: boolean;
    servicio?: string;
    strict?: boolean;
}

const LOG = {type: Log.label_base, label: "autodoc"};

/** Tamaño del documento serializado a partir del cual se avisa (1 MB). */
const TAMANO_AVISO = 1024 * 1024;

/**
 * Genera la documentación OpenAPI de los servicios del monorepo.
 *
 * Cada servicio se genera aislado de los demás: los que salen bien se guardan, los que fallan se informan
 * y la función termina rechazando (código de salida 1). Un servicio con avisos solo falla con `strict`.
 *
 * @param basedir - Raíz del monorepo.
 * @param config  - Opciones de la ejecución.
 */
export async function run(basedir: string, {env, out, dryRun = false, servicio, strict = false}: IConfigEjecucion): Promise<void> {
    if (!dryRun && out === undefined && env === undefined) {
        throw new Error("Falta --env (para escribir en MySQL), --out (para escribir ficheros) o --dry-run");
    }

    const {servicios, fallidos} = await listarServicios(basedir, servicio);
    const docs: IDocumentoServicio[] = [];
    const sinGuardar: string[] = [];
    const topologia = await configTopologia(basedir, env);
    for (const nombre of servicios) {
        try {
            docs.push(...await docService(basedir, nombre, {strict, topologia}));
        } catch (err) {
            Log.error(LOG, `${nombre}: ${err instanceof Error ? err.message : String(err)}`);
            fallidos.push(nombre);
        }
    }

    if (!dryRun) {
        if (out !== undefined) {
            await escribirFicheros(docs.map(d => d.doc), out);
        } else if (env !== undefined) {
            const {vigentes, completo} = await listarDeployments(basedir);
            const resultado = await guardarDocumentos({basedir, env, documentos: docs, vigentes, completo, filtrado: servicio !== undefined});
            sinGuardar.push(...resultado.fallidos);
            Log.info(LOG, `${resultado.versionesCreadas.length} versiones nuevas, ${resultado.sinCambios.length} sin cambios, ${resultado.bajas.length} bajas, ${resultado.fallidos.length} sin guardar, ${resultado.topologias.length} topologías escritas`);
            if (resultado.aviso !== undefined) {
                Log.error(LOG, `AVISO: ${resultado.aviso}`);
            }
        }
    }
    if (topologia !== undefined) {
        const con = docs.filter(d => d.topologia !== undefined && d.topologia !== null).length;
        Log.info(LOG, `${con} de ${docs.length} deployments con topología (entorno ${topologia.entorno})`);
    }
    Log.info(LOG, `${docs.length} documentos generados${dryRun ? " (dry-run: no se ha escrito nada)" : ""}`);

    if (fallidos.length > 0 || sinGuardar.length > 0) {
        const partes: string[] = [];
        if (fallidos.length > 0) {
            partes.push(`No se ha podido generar la documentación de: ${fallidos.join(", ")}`);
        }
        if (sinGuardar.length > 0) {
            partes.push(`No se ha podido guardar en la base: ${sinGuardar.join(", ")}`);
        }
        throw new Error(partes.join(". "));
    }
}

/**
 * Workspaces de `services/` que se documentan: directorios con `main.ts`, habilitados, de runtime Node y que
 * no son Next.js. Un `mrpack.json` que no se puede leer no aborta a los demás: el servicio sale en `fallidos`
 * (o, si se pidió ese servicio concreto, se propaga el error).
 */
async function listarServicios(basedir: string, filtro: string | undefined): Promise<{servicios: string[], fallidos: string[]}> {
    const raiz = `${basedir}/services`;
    const candidatos = await isDir(raiz) ? (await readDir(raiz)).sort() : [];
    if (filtro !== undefined && !candidatos.includes(filtro)) {
        throw new Error(`El servicio «${filtro}» no existe en services/`);
    }

    const servicios: string[] = [];
    const fallidos: string[] = [];
    for (const nombre of candidatos) {
        if (filtro !== undefined && nombre !== filtro) {
            continue;
        }
        let motivo: string | undefined;
        try {
            motivo = await motivoDescarte(`${raiz}/${nombre}`);
        } catch (err) {
            if (filtro !== undefined) {
                throw err;
            }
            Log.error(LOG, `${nombre}: ${err instanceof Error ? err.message : String(err)}`);
            fallidos.push(nombre);
            continue;
        }
        if (motivo === undefined) {
            servicios.push(nombre);
        } else if (filtro !== undefined) {
            throw new Error(`El servicio «${filtro}» no se documenta: ${motivo}`);
        }
    }

    return {servicios, fallidos};
}

/**
 * Deployments que declaran los `mrpack.json` de `services/` (cualquier workspace, esté habilitado o no) y si se
 * han podido leer todos. De aquí sale el conjunto de servicios vigentes, no de los documentos que se generan.
 */
async function listarDeployments(basedir: string): Promise<{vigentes: Set<string>, completo: boolean}> {
    const raiz = `${basedir}/services`;
    const vigentes = new Set<string>();
    let completo = true;
    for (const nombre of await isDir(raiz) ? await readDir(raiz) : []) {
        const dir = `${raiz}/${nombre}`;
        if (!await isDir(dir) || !await isFile(`${dir}/mrpack.json`)) {
            continue;
        }
        try {
            const {manifest} = await new ManifestWorkspaceLoader(dir).load();
            for (const deployment of manifest.deploy.kustomize?.map(k => k.name) ?? [nombre]) {
                vigentes.add(deployment);
            }
        } catch (err) {
            Log.error(LOG, `${nombre}: no se puede leer mrpack.json: ${err instanceof Error ? err.message : String(err)}`);
            completo = false;
        }
    }

    return {vigentes, completo};
}

async function motivoDescarte(dir: string): Promise<string | undefined> {
    if (!await isDir(dir) || !await isFile(`${dir}/main.ts`)) {
        return "no es un servicio (sin main.ts)";
    }
    const {manifest} = await new ManifestWorkspaceLoader(dir).load();
    if (!manifest.enabled || !manifest.deploy.enabled) {
        return "está deshabilitado";
    }
    if (manifest.deploy.runtime !== "node" || manifest.build.framework !== "meteored") {
        return "no es un servicio Node del framework meteored";
    }

    return undefined;
}

/**
 * Dónde y para qué entorno se extrae la topología.
 *
 * @property raiz     - Clon del repo kustomize (`<basedir>/kustomizar`).
 * @property entorno  - `test` | `produccion`.
 * @property soloZona - Zona de los deployments `alone`, si se conoce.
 */
interface IConfigTopologiaRun {
    raiz: string;
    entorno: "test" | "produccion";
    soloZona: string | null;
}

interface IConfigDocService {
    strict: boolean;
    topologia?: IConfigTopologiaRun;
}

/**
 * Configuración de la extracción de topología, o `undefined` si no procede (sin `--env`, entorno que no es
 * `test`/`produccion` o sin clon de kustomize): el autodoc sigue sin topología, con un aviso.
 */
async function configTopologia(basedir: string, env: string | undefined): Promise<IConfigTopologiaRun | undefined> {
    if (env === undefined) {
        return undefined;
    }
    if (!esEntornoTopologia(env)) {
        Log.error(LOG, `AVISO: sin topología: el entorno «${env}» no es test ni produccion`);

        return undefined;
    }
    const raiz = `${basedir}/kustomizar`;
    if (!await isDir(raiz)) {
        Log.error(LOG, "AVISO: sin topología: no hay clon del repo kustomize en kustomizar/");

        return undefined;
    }
    let soloZona: string | null = null;
    for (const candidato of [`${basedir}/entornos.json`, "/root/entornos.json"]) {
        if (await isFile(candidato)) {
            soloZona = zonaDeEntornos(await readFileString(candidato));
            break;
        }
    }

    return {raiz, entorno: env, soloZona};
}

async function docService(basedir: string, service: string, {strict, topologia}: IConfigDocService): Promise<IDocumentoServicio[]> {
    const dir = `${basedir}/services/${service}`;
    const {manifest} = await new ManifestWorkspaceLoader(dir).load();
    const program = crearPrograma(`${dir}/tsconfig.json`, `${dir}/main.ts`);
    const rutas = extraerRutas(program, basedir);

    const nombres = manifest.deploy.kustomize?.map(k => k.name) ?? [service];
    const docs = nombres.map(name => construirOpenAPI(rutas.grupos, {name}, rutas.componentes));
    const ubicaciones = new Map<string, string>();
    for (const operacion of rutas.grupos.flatMap(g => g.operaciones)) {
        ubicaciones.set(`${operacion.metodo} ${operacion.path}`, operacion.ubicacion);
    }
    const incidencias: IAviso[] = [...rutas.avisos, ...docs.flatMap(doc => validarOpenAPI(doc, ubicaciones))];
    for (const doc of docs) {
        const bytes = Buffer.byteLength(JSON.stringify(doc));
        if (bytes > TAMANO_AVISO) {
            incidencias.push({severidad: "aviso", mensaje: `el documento de ${doc.info.title} ocupa ${(bytes / TAMANO_AVISO).toFixed(1)} MB (más de 1 MB)`});
        }
    }

    for (const incidencia of incidencias) {
        Log.error(LOG, `${service}: ${formatearAviso(incidencia)}`);
    }
    const errores = incidencias.filter(i => i.severidad === "error").length;
    if (errores > 0 || (strict && incidencias.length > 0)) {
        throw new Error(`${incidencias.length} incidencias (${errores} errores)${strict ? ", con --strict" : ""}`);
    }

    const topologias = new Map<string, ITopologia>();
    if (topologia !== undefined && manifest.deploy.target === "k8s") {
        for (const {name, dir = "services"} of manifest.deploy.kustomize ?? []) {
            const {topologia: calculada, avisos} = await leerTopologia({raiz: topologia.raiz, dir, name, entorno: topologia.entorno, alone: manifest.deploy.alone === true, soloZona: topologia.soloZona});
            for (const aviso of avisos) {
                Log.error(LOG, `${service}: AVISO: topología: ${aviso}`);
            }
            if (calculada !== null) {
                topologias.set(name, calculada);
            }
        }
    }

    return docs.map(doc => ({workspace: `services/${service}`, doc, topologia: topologias.get(doc.info.title) ?? null}));
}

async function escribirFicheros(docs: IOpenAPI[], out: string): Promise<void> {
    await mkdir(out, {recursive: true});
    for (const doc of docs) {
        await writeFile(path.join(out, `${doc.info.title}.openapi.json`), `${JSON.stringify(doc, null, 2)}\n`);
    }
}
