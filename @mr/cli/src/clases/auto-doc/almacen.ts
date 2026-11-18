/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 16 Nov 2026 13:01:58 GMT
 * Hash: b06e2a766d6557ccafbfc10b19e258a4
 * Versión: 2026.11.16+6-juancmartinez
 * Anterior: 2026.11.12+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {execFile} from "node:child_process";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import os from "node:os";
import path from "node:path";

import {isFile, readFileString, readJSON} from "@mr/core-cli/fs";
import {MySQL} from "services-comun/modules/database/mysql";
import type {IOpenAPI} from "services-comun/modules/openapi/interface";

import {Log} from "../log";
import {aplicarSocket, calcularBajas, esReintentable, hashDocumento, necesitaVersion, normalizarRepositorio} from "./canonico";
import {escribirDepartamento} from "./departamento";
import {type ITopologia, esTopologiaNoSoportada} from "./topologia";

const execFileAsync = promisify(execFile);

const LOG = {type: Log.label_base, label: "autodoc"};

/** Longitud máxima de la columna `openapi_version.version`. */
const VERSION_MAX = 50;

/**
 * Documento de un deployment listo para guardar.
 *
 * @property workspace - Ruta del workspace que lo genera (`services/<nombre>`).
 * @property doc       - Documento OpenAPI; su `info.title` es el deployment.
 * @property topologia - Topología del deployment (`openapi_service.topology`), fuera del documento versionado y de su
 *                       hash. `null` o ausente: no se escribe y se conserva la anterior.
 * @property dpto      - Departamento del deployment (`openapi_service.dpto`). Ausente: no se ha intentado resolverlo (sin
 *                       clon de kustomize, por ejemplo) y no se toca lo guardado. `null`: se ha intentado y no se ha podido
 *                       saber con certeza, y se escribe `NULL` (así un servicio que cambia de departamento con una
 *                       kustomization que ya no se interpreta no conserva el departamento viejo).
 */
export interface IDocumentoServicio {
    workspace: string;
    doc: IOpenAPI;
    topologia?: ITopologia | null;
    dpto?: string | null;
}

/**
 * Datos de una ejecución de {@link guardarDocumentos}.
 *
 * @property basedir    - Raíz del monorepo.
 * @property env        - Entorno de las credenciales (`kustomizar/tmp/credenciales/mysql-services-socket-<env>.json`).
 * @property documentos - Documentos generados.
 * @property vigentes   - Deployments que declaran los `mrpack.json` del repositorio.
 * @property completo   - Todos los `mrpack.json` se han podido leer.
 * @property filtrado   - La ejecución se limitó a un servicio.
 */
export interface IConfigGuardar {
    basedir: string;
    env: string;
    documentos: IDocumentoServicio[];
    vigentes: ReadonlySet<string>;
    completo: boolean;
    filtrado: boolean;
}

/**
 * Resultado de guardar.
 *
 * @property versionesCreadas - Deployments para los que se ha creado una versión nueva.
 * @property sinCambios       - Deployments cuyo contrato no ha cambiado.
 * @property bajas            - Deployments marcados como retirados.
 * @property fallidos          - Deployments que no se han podido guardar (el resto sí se guardó).
 * @property topologias       - Deployments cuya topología se ha escrito.
 * @property dptos            - Deployments a los que se ha escrito un departamento.
 * @property dptosNulos       - Deployments a los que se ha escrito `NULL` como departamento.
 * @property aviso            - Por qué no se han calculado las bajas, si es el caso.
 */
export interface IResultadoGuardar {
    versionesCreadas: string[];
    sinCambios: string[];
    bajas: string[];
    fallidos: string[];
    topologias: string[];
    dptos: string[];
    dptosNulos: string[];
    aviso?: string;
}

interface IFilaServicio {
    id: number;
    currentVersion: number | null;
}

interface IFilaHash {
    hash: string;
}

interface IFilaDeployment {
    deployment: string;
}

/**
 * Repositorio de la ejecución como `propietario/nombre`: de `REPO_FULL_NAME` o, si falta, del `origin` de git.
 *
 * @param basedir - Raíz del monorepo (donde se ejecuta `git`).
 * @throws Si no hay ninguno de los dos o no tienen la forma esperada.
 */
export async function resolverRepositorio(basedir: string): Promise<string> {
    // Cloud Build pasa `https://github.com/${REPO_FULL_NAME}`: con la sustitución vacía llega solo el prefijo, que
    // no tiene la forma `propietario/nombre` y se trata como ausente.
    const desdeEntorno = normalizarRepositorio(process.env["REPO_FULL_NAME"] ?? "");
    if (desdeEntorno !== undefined) {
        return desdeEntorno;
    }

    let remoto: string;
    try {
        remoto = (await execFileAsync("git", ["remote", "get-url", "origin"], {cwd: basedir})).stdout;
    } catch {
        throw new Error("No se puede saber el repositorio: falta REPO_FULL_NAME (o no tiene la forma propietario/nombre) y no se puede leer el remoto «origin» de git (¿hay git en el entorno?)");
    }
    const repositorio = normalizarRepositorio(remoto);
    if (repositorio === undefined) {
        throw new Error("No se puede saber el repositorio: el remoto «origin» no tiene la forma propietario/nombre");
    }

    return repositorio;
}

/**
 * Versión desplegada de un workspace (`<workspace>/version.txt`), o `null` si no hay.
 *
 * @param basedir   - Raíz del monorepo.
 * @param workspace - Ruta del workspace.
 */
export async function leerVersion(basedir: string, workspace: string): Promise<string | null> {
    const fichero = `${basedir}/${workspace}/version.txt`;
    if (!await isFile(fichero)) {
        return null;
    }
    const version = (await readFileString(fichero)).trim();

    return version === "" ? null : version.slice(0, VERSION_MAX);
}

/**
 * Guarda los documentos en la base `doc`: una transacción por deployment, y una versión nueva solo si el contrato
 * ha cambiado (hash del documento canónico). Después marca como retirados los deployments del repositorio que ya no
 * existen.
 *
 * Con `MYSQL_SOCKET` en el entorno, el socket de las credenciales se sustituye por ese (así no depende de que el
 * fichero de credenciales de kustomize coincida con la instancia del trigger).
 *
 * @param config - Documentos y contexto de la ejecución.
 */
export async function guardarDocumentos({basedir, env, documentos, vigentes, completo, filtrado}: IConfigGuardar): Promise<IResultadoGuardar> {
    const repositorio = await resolverRepositorio(basedir);
    const commit = process.env["COMMIT_SHA"];
    const commitSha = commit !== undefined && /^[0-9a-f]{40}$/i.test(commit.trim()) ? commit.trim() : null;

    const credenciales = `${basedir}/kustomizar/tmp/credenciales/mysql-services-socket-${env}.json`;
    const temporal = await credencialesConSocket(credenciales, process.env["MYSQL_SOCKET"]);
    const db = MySQL.build({credenciales: temporal?.fichero ?? credenciales, database: "doc"});
    const resultado: IResultadoGuardar = {versionesCreadas: [], sinCambios: [], bajas: [], fallidos: [], topologias: [], dptos: [], dptosNulos: []};
    let topologiaSinSoporte = false;
    let dptoSinSoporte = false;

    try {
        for (const {workspace, doc, topologia, dpto} of documentos) {
            // Un fallo en un deployment no corta el resto: se registra y se sigue. Las bajas salen de los manifests,
            // no de lo guardado, así que se calculan igualmente.
            try {
                const version = await leerVersion(basedir, workspace);
                const {creada, topologiaGuardada, topologiaSinSoporte: sinSoporte, dptoGuardado, dptoSinSoporte: dptoSinSoporteDoc} = await guardarConReintento(db, {repositorio, workspace, doc, version, commitSha, topologia: topologia ?? null, dpto});
                (creada ? resultado.versionesCreadas : resultado.sinCambios).push(doc.info.title);
                if (topologiaGuardada) {
                    resultado.topologias.push(doc.info.title);
                }
                if (dptoGuardado) {
                    (dpto === null ? resultado.dptosNulos : resultado.dptos).push(doc.info.title);
                }
                if (dptoSinSoporteDoc && !dptoSinSoporte) {
                    dptoSinSoporte = true;
                    Log.error(LOG, "AVISO: la base `doc` no admite el departamento (falta la columna dpto o el GRANT de escritura): se documenta sin dpto");
                }
                if (sinSoporte && !topologiaSinSoporte) {
                    topologiaSinSoporte = true;
                    Log.error(LOG, "AVISO: la base `doc` no admite la topología (faltan las columnas topology/topology_at o el GRANT de escritura): se documenta sin topología");
                }
            } catch (err) {
                Log.error(LOG, `${doc.info.title}: no se ha podido guardar: ${err instanceof Error ? err.message : String(err)}`);
                resultado.fallidos.push(doc.info.title);
            }
        }

        const registrados = await db.select<IFilaDeployment>("SELECT deployment FROM openapi_service WHERE repository = ? AND removed_at IS NULL", [repositorio], {master: true});
        const {bajas, aviso} = calcularBajas({vigentes, registrados: registrados.map(r => r.deployment), completo, filtrado});
        if (bajas.length > 0) {
            await db.update("UPDATE openapi_service SET removed_at = NOW() WHERE repository = ? AND removed_at IS NULL AND deployment IN (?)", [repositorio, bajas]);
        }
        resultado.bajas = bajas;
        resultado.aviso = aviso;
    } finally {
        await db.close();
        if (temporal !== undefined) {
            await rm(temporal.dir, {recursive: true, force: true});
        }
    }

    return resultado;
}

interface IConfigDocumento {
    repositorio: string;
    workspace: string;
    doc: IOpenAPI;
    version: string | null;
    commitSha: string | null;
    topologia: ITopologia | null;
    dpto?: string | null;
}

interface IResultadoDocumento {
    creada: boolean;
    topologiaGuardada: boolean;
    topologiaSinSoporte: boolean;
    dptoGuardado: boolean;
    dptoSinSoporte: boolean;
}

/**
 * Guarda un documento y, si falla por una carrera con otro build (`ER_DUP_ENTRY`: dos inserciones del mismo
 * `openapi_service` nuevo; `ER_LOCK_DEADLOCK`), lo reintenta una vez.
 */
async function guardarConReintento(db: MySQL, config: IConfigDocumento): Promise<IResultadoDocumento> {
    try {
        return await guardarDocumento(db, config);
    } catch (err) {
        if (!esReintentable(err)) {
            throw err;
        }
        Log.info(LOG, `${config.doc.info.title}: conflicto con otro guardado concurrente, se reintenta`);

        return guardarDocumento(db, config);
    }
}

/**
 * Guarda un documento en una transacción. `creada` es `true` si ha creado una versión nueva.
 *
 * La topología y el departamento se escriben en la misma transacción pero fuera del documento versionado (no entran en el
 * hash), cada uno con su `UPDATE`. Si la base no los admite (columna inexistente o sin permiso), el documento se guarda
 * igualmente: un `UPDATE` fallido no aborta la transacción en MySQL. Un `dpto` `null` escribe `NULL`; uno ausente no toca nada.
 */
async function guardarDocumento(db: MySQL, {repositorio, workspace, doc, version, commitSha, topologia, dpto}: IConfigDocumento): Promise<IResultadoDocumento> {
    const deployment = doc.info.title;
    const hash = hashDocumento(doc);
    const transaccion = await db.transaction();
    await transaccion.start();

    try {
        const [existente] = await transaccion.query<IFilaServicio>("SELECT id, current_version AS currentVersion FROM openapi_service WHERE deployment = ? FOR UPDATE", [deployment]);
        let servicioId: number;
        let actual: number | null = null;
        if (existente === undefined) {
            const insertado = await transaccion.insert("INSERT INTO openapi_service (repository, deployment, workspace) VALUES (?, ?, ?)", [repositorio, deployment, workspace]);
            servicioId = insertado.insertId;
        } else {
            servicioId = existente.id;
            actual = existente.currentVersion;
            await transaccion.update("UPDATE openapi_service SET repository = ?, workspace = ?, last_seen_at = NOW(), removed_at = NULL WHERE id = ?", [repositorio, workspace, servicioId]);
        }

        let hashActual: string | undefined;
        if (actual !== null) {
            const [fila] = await transaccion.query<IFilaHash>("SELECT hash FROM openapi_version WHERE id = ?", [actual]);
            hashActual = fila?.hash;
        }

        const crear = necesitaVersion(hashActual, hash);
        if (crear) {
            const nueva = await transaccion.insert("INSERT INTO openapi_version (service_id, hash, version, commit_sha, doc) VALUES (?, ?, ?, ?, ?)", [servicioId, hash, version, commitSha, JSON.stringify(doc)]);
            await transaccion.update("UPDATE openapi_service SET current_version = ? WHERE id = ?", [nueva.insertId, servicioId]);
        }

        let topologiaGuardada = false;
        let topologiaSinSoporte = false;
        if (topologia !== null) {
            try {
                await transaccion.update("UPDATE openapi_service SET topology = ?, topology_at = NOW() WHERE id = ?", [JSON.stringify(topologia), servicioId]);
                topologiaGuardada = true;
            } catch (err) {
                if (!esTopologiaNoSoportada(err)) {
                    throw err;
                }
                topologiaSinSoporte = true;
            }
        }
        const {guardado: dptoGuardado, sinSoporte: dptoSinSoporte} = await escribirDepartamento(transaccion, servicioId, dpto);
        await transaccion.commit();

        return {creada: crear, topologiaGuardada, topologiaSinSoporte, dptoGuardado, dptoSinSoporte};
    } catch (err) {
        await transaccion.rollback().catch((errRollback: unknown) => {
            Log.error(LOG, `${deployment}: el rollback ha fallado: ${errRollback instanceof Error ? errRollback.message : String(errRollback)}`);
        });
        throw err;
    }
}

/**
 * Fichero temporal con las credenciales y el socket cambiado, o `undefined` si no hay socket que aplicar.
 */
async function credencialesConSocket(credenciales: string, socket: string | undefined): Promise<{dir: string, fichero: string} | undefined> {
    if (socket === undefined || socket.trim() === "") {
        return undefined;
    }
    const dir = await mkdtemp(path.join(os.tmpdir(), "autodoc-"));
    const fichero = path.join(dir, "mysql.json");
    try {
        await writeFile(fichero, JSON.stringify(aplicarSocket(await readJSON<unknown>(credenciales), socket.trim())), {mode: 0o600});
    } catch (err) {
        await rm(dir, {recursive: true, force: true});
        throw err;
    }

    return {dir, fichero};
}
