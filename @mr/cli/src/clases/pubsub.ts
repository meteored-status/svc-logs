/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 415bb2ebd68a8abc09142991c35ae881
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import {stat} from "node:fs/promises";
import path from "node:path";

import {type IConfigEmulador, leerConfigEmulador, resolverConfigEmulador} from "@mr/core-dev/pubsub/config";
import {endpointPush, FICHERO_DECLARACION, fusionar, type IDeclaracionWorkspace, type IPushDeclarado, type ITopologia, puertoPush} from "@mr/core-dev/pubsub/declaracion";
import {buscarDeclaraciones} from "@mr/core-dev/pubsub/descubrir";
import {EmuladorPubSub, type IInformeAplicar, mensajeEmuladorCaido, type TAccionAplicar, type TEstadoRecurso} from "@mr/core-dev/pubsub/emulador";
import {Colors} from "@mr/core-cli/colors";

import {Comando} from "./comando";
import {Log} from "./log";

/** Lo que dicen `mrpack pubsub` y `devel -p` cuando ningún workspace del repo declara su topología. */
export const MENSAJE_SIN_DECLARACIONES = "Este repo no declara recursos de Pub/Sub (`mrpack.pubsub.ts`)";

/** Cada cuántos milisegundos revisa {@link vigilar} las declaraciones y el emulador. */
const INTERVALO_VIGILANCIA_MS = 15_000;

/** Lo que espera {@link comprobarPush} a que un servicio conteste a `/admin/pubsub/`. */
const TIMEOUT_SERVICIO_MS = 2_000;

/** Anchura de la columna de acción del resumen: la de `push-actualizado`, la más larga. */
const ANCHO_ACCION = "push-actualizado".length;

/** Colores de cada acción de {@link EmuladorPubSub.aplicar} en el resumen. */
const COLOR_ACCION: Record<TAccionAplicar, string[]> = {
    "creado": [Colors.FgGreen],
    "existia": [Colors.FgWhite, Colors.Dim],
    "push-actualizado": [Colors.FgYellow],
    "recreado": [Colors.FgYellow],
    "difiere": [Colors.FgRed],
};

/** Colores de cada estado de {@link EmuladorPubSub.estado} en la tabla. */
const COLOR_ESTADO: Record<TEstadoRecurso, string[]> = {
    "ok": [Colors.FgGreen],
    "falta": [Colors.FgRed],
    "difiere": [Colors.FgYellow],
};

/**
 * Un repo con sus declaraciones y su emulador.
 *
 * @property repo - Nombre del repo: la carpeta raíz. Es la label `mrpack-repo` de lo que se da de alta.
 * @property workspaces - Workspaces que declaran su topología (rutas relativas a la raíz).
 * @property emulador - Cliente del emulador, con los datos de conexión ya resueltos.
 */
interface IContexto {
    repo: string;
    workspaces: string[];
    emulador: EmuladorPubSub;
}

/**
 * Lo que contesta `GET /admin/pubsub/` en `data` (ver `modoPubSub` de `@mr/core-workload`).
 *
 * @property emulador - `host:puerto` del emulador, o `null` si el servicio habla con Google Cloud.
 * @property proyecto - Proyecto con el que habla con el emulador, o `null` si no se ha fijado.
 */
interface IModoServicio {
    emulador?: string | null;
    proyecto?: string | null;
}

/**
 * Resultado de {@link preparar}: la topología dada de alta y lo que necesita quien ejecuta los servicios contra el emulador.
 *
 * @property emulador - Cliente del emulador.
 * @property topologia - Topología fusionada, tal y como quedó en el emulador.
 * @property entorno - Variables de entorno (`PUBSUB_EMULATOR_HOST`, `PUBSUB_PROJECT_ID`) con las que hay que lanzar los servicios.
 * @property repo - Nombre del repo.
 * @property workspaces - Workspaces que declaran.
 * @property firmas - `mtime` de cada `mrpack.pubsub.ts` justo antes de evaluarlos, para que {@link vigilar} detecte los cambios.
 */
export interface ISesionPubSub {
    emulador: EmuladorPubSub;
    topologia: ITopologia;
    entorno: Record<string, string>;
    repo: string;
    workspaces: string[];
    firmas: Map<string, number>;
}

/**
 * Lo que {@link prepararEjecucion} necesita de un servicio: `Service` de `devel`.
 *
 * @property setEntorno - Fija las variables de entorno con las que se lanza el proceso de ejecución.
 * @property setAntesDeReiniciar - Fija lo que se espera antes de cada reinicio automático.
 */
export interface IServicioPubSub {
    setEntorno(entorno: Record<string, string>): void;
    setAntesDeReiniciar(hook: () => Promise<void>): void;
}

/**
 * Control de {@link vigilar}.
 *
 * @property parar - Detiene la revisión periódica.
 * @property reponer - Hace ahora una pasada de revisión (o espera a la que ya está en curso). No rechaza nunca: los
 *   errores se registran en el log. Es lo que `devel` llama antes de reiniciar un servicio caído.
 */
export interface IVigilancia {
    parar(): void;
    reponer(): Promise<void>;
}

/**
 * Texto de un error para mostrárselo a la persona, sin la traza.
 *
 * @param err - Lo que se capturó.
 * @returns El mensaje del error, o el valor convertido a texto.
 */
export function mensajeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Indica si algún workspace del repo declara su topología de Pub/Sub.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns `true` si hay algún `mrpack.pubsub.ts`.
 */
export async function hayDeclaraciones(basedir: string): Promise<boolean> {
    return (await buscarDeclaraciones(basedir)).length > 0;
}

/**
 * Reúne lo que necesita cualquier comando: los workspaces que declaran y el emulador.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns El contexto, o `undefined` si el repo no declara nada (en cuyo caso no se comprueba ni el emulador).
 */
async function cargarContexto(basedir: string): Promise<IContexto | undefined> {
    const workspaces = await buscarDeclaraciones(basedir);
    if (workspaces.length === 0) {
        return undefined;
    }
    const config = resolverConfigEmulador({env: process.env, fichero: await leerConfigEmulador(basedir)});
    return {repo: path.basename(basedir), workspaces, emulador: EmuladorPubSub.build(config)};
}

/**
 * Comprueba que el emulador responde. **No lo arranca**: es un docker de mrenv y levantarlo es cosa de la persona.
 *
 * @param emulador - Cliente del emulador.
 * @throws {Error} Con {@link mensajeEmuladorCaido} si no responde.
 */
async function exigirEmulador(emulador: EmuladorPubSub): Promise<void> {
    if (!await emulador.disponible()) {
        throw new Error(mensajeEmuladorCaido(emulador.config.host));
    }
}

/**
 * Evalúa los `mrpack.pubsub.ts` fuera de proceso (`@mr/core-dev/pubsub/evaluar.mjs`): son TypeScript que hay que empaquetar
 * y ejecutar, y no se puede hacer dentro del bundle de `mrpack`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param workspaces - Workspaces cuya declaración se evalúa.
 * @returns Las declaraciones, en el orden recibido.
 * @throws {Error} Si alguna no compila, lanza al evaluarse o no exporta un objeto: el mensaje trae el `stderr` del evaluador.
 */
async function evaluar(basedir: string, workspaces: string[]): Promise<IDeclaracionWorkspace[]> {
    if (workspaces.length === 0) {
        return [];
    }

    const {status, stdout, stderr} = await Comando("yarn", ["workspace", "@mr/core-dev", "node", "pubsub/evaluar.mjs", basedir, ...workspaces], {cwd: basedir, colores: false});
    if (status !== 0) {
        throw new Error(`No se han podido evaluar los ${FICHERO_DECLARACION}:\n${stderr.trim() || `el evaluador terminó con código ${status}`}`);
    }

    try {
        return (JSON.parse(stdout) as {declaraciones: IDeclaracionWorkspace[]}).declaraciones;
    } catch (err) {
        throw new Error(`El evaluador de ${FICHERO_DECLARACION} no devolvió un JSON válido: ${mensajeError(err)}`);
    }
}

/**
 * Evalúa y fusiona las declaraciones de los workspaces.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param workspaces - Workspaces que declaran.
 * @returns La topología del repo.
 * @throws {Error} Si alguna declaración no es válida o hay conflictos entre ellas.
 */
async function cargarTopologia(basedir: string, workspaces: string[]): Promise<ITopologia> {
    return fusionar(await evaluar(basedir, workspaces));
}

/**
 * `mtime` de cada declaración. Un fichero que no se puede leer (borrado entre el listado y esto) no cuenta.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param workspaces - Workspaces que declaran.
 * @returns `mtime` en milisegundos por workspace.
 */
async function firmar(basedir: string, workspaces: string[]): Promise<Map<string, number>> {
    const firmas = new Map<string, number>();
    for (const workspace of workspaces) {
        try {
            firmas.set(workspace, (await stat(`${basedir}/${workspace}/${FICHERO_DECLARACION}`)).mtimeMs);
        } catch {
            // ha desaparecido: no cuenta
        }
    }
    return firmas;
}

/**
 * Indica si dos juegos de `mtime` (ver {@link firmar}) son idénticos: mismos workspaces y mismas fechas.
 */
function firmasIguales(a: Map<string, number>, b: Map<string, number>): boolean {
    return a.size === b.size && [...a].every(([workspace, mtime]) => b.get(workspace) === mtime);
}

/**
 * Línea de un recurso para el log: `<acción o estado> <tipo> <nombre> (<workspace>)`, con las columnas alineadas.
 */
function lineaRecurso(texto: string, color: string[], recurso: {tipo: string; nombre: string; workspace: string}, anchos: {texto: number; nombre: number}): string {
    const dueno = recurso.workspace.startsWith("(") ? recurso.workspace : `(${recurso.workspace})`;
    return `${Colors.colorize(color, texto.padEnd(anchos.texto))} ${recurso.tipo.padEnd("suscripcion".length)} ${recurso.nombre.padEnd(anchos.nombre)} ${dueno}`;
}

/**
 * Primera línea de cada comando: contra qué emulador y para qué repo trabaja.
 */
function mostrarCabecera(emulador: EmuladorPubSub, repo: string, label: string): void {
    Log.info({type: Log.label_pubsub, label}, `Emulador ${emulador.config.host} (proyecto ${emulador.config.proyecto}), repo ${Colors.colorize([Colors.FgWhite, Colors.Bright], repo)}`);
}

/**
 * Una línea de log por recurso del informe de {@link EmuladorPubSub.aplicar}: acción, tipo, nombre y workspace.
 */
function mostrarInforme(informe: IInformeAplicar, label: string): void {
    const anchos = {texto: ANCHO_ACCION, nombre: Math.max(0, ...informe.recursos.map(({nombre}) => nombre.length))};
    for (const recurso of informe.recursos) {
        const detalle = recurso.detalle !== undefined ? ` — ${recurso.detalle}` : "";
        Log.info({type: Log.label_pubsub, label}, `${lineaRecurso(recurso.accion, COLOR_ACCION[recurso.accion], recurso, anchos)}${detalle}`);
    }
}

/**
 * Da de alta en el emulador la topología declarada en los `mrpack.pubsub.ts` del repo (modo `arranque`: corrige lo que
 * difiere) y registra qué se hizo con cada recurso.
 *
 * **Nunca arranca el docker del emulador**: si no responde, falla con el mensaje para la persona.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Lo que necesita `devel` para ejecutar los servicios contra el emulador y vigilarlo.
 * @throws {Error} Si el repo no declara nada, el emulador no responde, alguna declaración no es válida o hay conflictos entre ellas.
 */
export async function preparar(basedir: string): Promise<ISesionPubSub> {
    const contexto = await cargarContexto(basedir);
    if (contexto === undefined) {
        throw new Error(MENSAJE_SIN_DECLARACIONES);
    }

    const {repo, workspaces, emulador} = contexto;
    await exigirEmulador(emulador);
    const firmas = await firmar(basedir, workspaces);
    const topologia = await cargarTopologia(basedir, workspaces);

    mostrarCabecera(emulador, repo, "alta");
    mostrarInforme(await emulador.aplicar(topologia, {modo: "arranque", repo}), "alta");

    return {emulador, topologia, entorno: emulador.entorno, repo, workspaces, firmas};
}

/**
 * `mrpack pubsub -u`: da de alta la topología declarada en el emulador.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function alta(basedir: string): Promise<void> {
    if (!await hayDeclaraciones(basedir)) {
        Log.info({type: Log.label_pubsub, label: "alta"}, MENSAJE_SIN_DECLARACIONES);
        return;
    }
    await preparar(basedir);
}

/**
 * Comprueba a qué modo de Pub/Sub responde el servicio que recibe una suscripción push, con `GET /admin/pubsub/`.
 *
 * No es un fallo que no responda: el servicio puede estar parado, y quien llama solo lo cuenta.
 *
 * @param push - Destino de la suscripción. Solo se usa su puerto: en local el servicio está en `localhost`.
 * @param config - Emulador contra el que deberían estar los servicios.
 * @returns Una frase con lo que se encontró.
 */
async function comprobarPush(push: IPushDeclarado, config: IConfigEmulador): Promise<string> {
    const inesperada = "devuelve una respuesta inesperada en /admin/pubsub/ (no es el JSON esperado)";
    const url = `http://localhost:${puertoPush(push)}/admin/pubsub/`;

    let respuesta: Response;
    try {
        respuesta = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_SERVICIO_MS)});
    } catch {
        return "no responde (servicio parado)";
    }

    if (respuesta.status === 404) {
        return "no expone /admin/pubsub/ (framework antiguo)";
    }
    if (!respuesta.ok) {
        return `devuelve una respuesta inesperada en /admin/pubsub/ (HTTP ${respuesta.status})`;
    }

    let data: IModoServicio | undefined;
    try {
        data = ((await respuesta.json()) as {data?: IModoServicio}).data;
    } catch {
        return inesperada;
    }
    if (typeof data !== "object" || data === null) {
        return inesperada;
    }

    const emulador = data.emulador ?? null;
    const proyecto = data.proyecto ?? null;
    if (emulador === null) {
        return "responde contra Google Cloud";
    }
    if (emulador === config.host && proyecto === config.proyecto) {
        return `responde en modo emulador ${emulador} (${proyecto})`;
    }
    return `responde con otro emulador (${emulador}, proyecto ${proyecto ?? "sin fijar"}; el esperado es ${config.host}, proyecto ${config.proyecto})`;
}

/**
 * `mrpack pubsub -s`: compara la topología declarada con lo que hay en el emulador y, para cada suscripción push, comprueba
 * a qué modo responde el servicio que la recibe. Solo lee: no toca nada.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @throws {Error} Si el emulador no responde, alguna declaración no es válida o hay conflictos entre ellas.
 */
export async function estado(basedir: string): Promise<void> {
    const label = "estado";
    const contexto = await cargarContexto(basedir);
    if (contexto === undefined) {
        Log.info({type: Log.label_pubsub, label}, MENSAJE_SIN_DECLARACIONES);
        return;
    }

    const {repo, workspaces, emulador} = contexto;
    await exigirEmulador(emulador);
    const topologia = await cargarTopologia(basedir, workspaces);
    const informe = await emulador.estado(topologia, {repo});

    mostrarCabecera(emulador, repo, label);

    const anchos = {texto: "falta".length, nombre: Math.max(0, ...informe.recursos.map(({nombre}) => nombre.length))};
    for (const recurso of informe.recursos) {
        const detalle = recurso.detalle !== undefined ? ` — ${recurso.detalle}` : "";
        Log.info({type: Log.label_pubsub, label}, `${lineaRecurso(recurso.estado, COLOR_ESTADO[recurso.estado], recurso, anchos)}${detalle}`);
    }

    for (const suscripcion of topologia.suscripciones) {
        if (suscripcion.push !== undefined) {
            const destino = endpointPush(suscripcion.push, emulador.config.pushHost);
            Log.info({type: Log.label_pubsub, label}, `${suscripcion.nombre}: push a ${destino}; el servicio ${Colors.colorize([Colors.FgWhite, Colors.Bright], await comprobarPush(suscripcion.push, emulador.config))}`);
        }
    }

    if (informe.extras.length > 0) {
        Log.info({type: Log.label_pubsub, label}, `En el emulador y no declarados (${informe.extras.length}):`);
        for (const extra of informe.extras) {
            const dueno = extra.repo === undefined ? "sin dueño (creado a mano o con otra herramienta)" : `repo ${extra.repo}${extra.propio ? ": lo borraría --limpiar" : ""}`;
            Log.info({type: Log.label_pubsub, label}, `${Colors.colorize([Colors.FgWhite, Colors.Dim], "extra")} ${extra.tipo.padEnd("suscripcion".length)} ${extra.nombre} — ${dueno}`);
        }
    }

    const faltan = informe.recursos.filter(({estado: valor}) => valor === "falta").length;
    const difieren = informe.recursos.filter(({estado: valor}) => valor === "difiere").length;
    const resumen = `${informe.recursos.length - faltan - difieren}/${informe.recursos.length} recursos ok`;
    if (faltan + difieren > 0) {
        Log.info({type: Log.label_pubsub, label}, Colors.colorize([Colors.FgYellow], `${resumen}: ${faltan} faltan y ${difieren} difieren. \`yarn mrpack pubsub -u\` los da de alta o los corrige`));
    } else {
        Log.info({type: Log.label_pubsub, label}, Colors.colorize([Colors.FgGreen], resumen));
    }
}

/**
 * `mrpack pubsub -r`: descarta los mensajes pendientes de las suscripciones declaradas, borrándolas y recreándolas con su
 * configuración declarada. Antes da de alta lo que falte (los topics tienen que existir para recrearlas).
 *
 * Los consumidores pull conectados pierden su stream y tienen que reconectarse.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @throws {Error} Si el emulador no responde, alguna declaración no es válida o hay conflictos entre ellas.
 */
export async function reset(basedir: string): Promise<void> {
    const label = "reset";
    const contexto = await cargarContexto(basedir);
    if (contexto === undefined) {
        Log.info({type: Log.label_pubsub, label}, MENSAJE_SIN_DECLARACIONES);
        return;
    }

    const {repo, workspaces, emulador} = contexto;
    await exigirEmulador(emulador);
    const topologia = await cargarTopologia(basedir, workspaces);
    const informe = await emulador.aplicar(topologia, {modo: "arranque", repo});
    mostrarInforme({recursos: informe.recursos.filter(({accion}) => accion !== "existia")}, label);
    await emulador.purgar(topologia.suscripciones, {repo});

    const anchos = {texto: ANCHO_ACCION, nombre: Math.max(0, ...topologia.suscripciones.map(({nombre}) => nombre.length))};
    for (const suscripcion of topologia.suscripciones) {
        Log.info({type: Log.label_pubsub, label}, lineaRecurso("purgada", [Colors.FgYellow], {tipo: "suscripcion", nombre: suscripcion.nombre, workspace: suscripcion.consumidor}, anchos));
    }
    Log.info({type: Log.label_pubsub, label}, `${topologia.suscripciones.length} suscripciones recreadas sin sus mensajes pendientes. Los consumidores pull conectados se reconectan.`);
}

/**
 * `mrpack pubsub -l`: borra del emulador lo que este repo dio de alta y ya no declara. Lo que no tiene la label de este
 * repo (otro repo, creado a mano) no se toca nunca.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @throws {Error} Si el emulador no responde, alguna declaración no es válida o hay conflictos entre ellas.
 */
export async function limpiar(basedir: string): Promise<void> {
    const label = "limpiar";
    const contexto = await cargarContexto(basedir);
    if (contexto === undefined) {
        Log.info({type: Log.label_pubsub, label}, MENSAJE_SIN_DECLARACIONES);
        return;
    }

    const {repo, workspaces, emulador} = contexto;
    await exigirEmulador(emulador);
    const topologia = await cargarTopologia(basedir, workspaces);
    const borrado = await emulador.limpiar(topologia, {repo});

    if (borrado.length === 0) {
        Log.info({type: Log.label_pubsub, label}, "No hay nada que limpiar: el emulador no tiene recursos de este repo que ya no se declaren");
        return;
    }
    for (const recurso of borrado) {
        Log.info({type: Log.label_pubsub, label}, `${Colors.colorize([Colors.FgRed], "borrado".padEnd(ANCHO_ACCION))} ${recurso}`);
    }
}

/**
 * Revisión periódica de {@link vigilar}: vuelve a evaluar las declaraciones si cambian y repone en el emulador lo que falte.
 */
class Vigilancia implements IVigilancia {
    private readonly basedir: string;
    private readonly emulador: EmuladorPubSub;
    private readonly repo: string;
    private topologia: ITopologia;
    private firmas: Map<string, number>;
    private readonly vistos: Set<string>;
    private readonly diferencias: Map<string, string>;
    private avisadoCaido: boolean;
    private ultimoError?: string;
    private pasada?: Promise<void>;
    private temporizador?: NodeJS.Timeout;

    public constructor(basedir: string, sesion: ISesionPubSub) {
        this.basedir = basedir;
        this.emulador = sesion.emulador;
        this.repo = sesion.repo;
        this.topologia = sesion.topologia;
        this.firmas = sesion.firmas;
        this.vistos = new Set();
        this.diferencias = new Map();
        this.avisadoCaido = false;

        this.registrarVistos();
    }

    /**
     * Empieza la revisión cada {@link INTERVALO_VIGILANCIA_MS}. El temporizador no mantiene vivo el proceso.
     */
    public iniciar(): void {
        this.parar();
        this.temporizador = setInterval(() => {
            void this.reponer();
        }, INTERVALO_VIGILANCIA_MS);
        this.temporizador.unref();
    }

    public parar(): void {
        if (this.temporizador !== undefined) {
            clearInterval(this.temporizador);
            this.temporizador = undefined;
        }
    }

    public reponer(): Promise<void> {
        this.pasada ??= this.revisar().finally(() => {
            this.pasada = undefined;
        });
        return this.pasada;
    }

    private registrarVistos(): void {
        for (const topic of this.topologia.topics) {
            this.vistos.add(`topic ${topic.nombre}`);
        }
        for (const suscripcion of this.topologia.suscripciones) {
            this.vistos.add(`suscripcion ${suscripcion.nombre}`);
        }
    }

    /**
     * Una pasada completa. No rechaza nunca: cualquier error se registra, una vez por mensaje distinto.
     */
    private async revisar(): Promise<void> {
        try {
            await this.recargar();

            if (!await this.emulador.disponible()) {
                if (!this.avisadoCaido) {
                    this.avisadoCaido = true;
                    Log.error({type: Log.label_pubsub, label: "vigilancia"}, `El emulador de Pub/Sub no responde en ${this.emulador.config.host}: se repondrá la topología cuando vuelva`);
                }
                return;
            }
            if (this.avisadoCaido) {
                this.avisadoCaido = false;
                Log.info({type: Log.label_pubsub, label: "vigilancia"}, `El emulador de Pub/Sub vuelve a responder en ${this.emulador.config.host}`);
            }

            this.registrar(await this.emulador.aplicar(this.topologia, {modo: "vigilancia", repo: this.repo}));
            this.ultimoError = undefined;
        } catch (err) {
            this.avisarError(mensajeError(err));
        }
    }

    /**
     * Vuelve a evaluar las declaraciones si cambió el `mtime` de alguna, o apareció o desapareció alguna. Si la evaluación
     * falla, lo registra y sigue con la topología anterior hasta que el fichero vuelva a cambiar.
     */
    private async recargar(): Promise<void> {
        let workspaces: string[];
        try {
            workspaces = await buscarDeclaraciones(this.basedir);
        } catch (err) {
            this.avisarError(`No se han podido buscar los ${FICHERO_DECLARACION}: ${mensajeError(err)}`);
            return;
        }

        const firmas = await firmar(this.basedir, workspaces);
        if (firmasIguales(firmas, this.firmas)) {
            return;
        }
        this.firmas = firmas;

        try {
            this.topologia = await cargarTopologia(this.basedir, workspaces);
            Log.info({type: Log.label_pubsub, label: "vigilancia"}, `Declaraciones recargadas: ${this.topologia.topics.length} topics y ${this.topologia.suscripciones.length} suscripciones`);
        } catch (err) {
            Log.error({type: Log.label_pubsub, label: "vigilancia"}, `Declaraciones modificadas, pero no se han podido recargar: se mantiene la topología anterior. ${mensajeError(err)}`);
        }
    }

    /**
     * Registra solo lo que la pasada hizo (`creado`) y las diferencias nuevas, una vez por recurso y diferencia.
     */
    private registrar(informe: IInformeAplicar): void {
        for (const recurso of informe.recursos) {
            const clave = `${recurso.tipo} ${recurso.nombre}`;
            if (recurso.accion === "creado") {
                const origen = this.vistos.has(clave) ? "topología restaurada" : "recurso nuevo dado de alta";
                Log.info({type: Log.label_pubsub, label: "vigilancia"}, `${origen}: ${clave} (${recurso.workspace})`);
                this.vistos.add(clave);
            }

            if (recurso.accion !== "difiere") {
                this.diferencias.delete(clave);
            } else if (this.diferencias.get(clave) !== recurso.detalle) {
                this.diferencias.set(clave, recurso.detalle ?? "");
                Log.error({type: Log.label_pubsub, label: "vigilancia"}, `${clave} (${recurso.workspace}) difiere de lo declarado y no se toca con los servicios en marcha: ${recurso.detalle ?? ""}. Se corrige al reiniciar con PubSub o con \`yarn mrpack pubsub -u\``);
            }
        }
    }

    private avisarError(mensaje: string): void {
        if (mensaje !== this.ultimoError) {
            this.ultimoError = mensaje;
            Log.error({type: Log.label_pubsub, label: "vigilancia"}, mensaje);
        }
    }
}

/**
 * Vigila el emulador mientras los servicios están en marcha: cada 15 s repone lo que falte (un emulador reiniciado arranca
 * vacío) y vuelve a evaluar las declaraciones si alguna ha cambiado.
 *
 * En modo `vigilancia` solo crea lo que falta: lo que difiere de la declaración se informa una vez y no se toca, porque
 * recrear una suscripción quitaría a los servicios sus mensajes en vuelo.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param sesion - Lo que devolvió {@link preparar}.
 * @returns Control para parar la vigilancia o forzar una pasada.
 */
export function vigilar(basedir: string, sesion: ISesionPubSub): IVigilancia {
    const vigilancia = new Vigilancia(basedir, sesion);
    vigilancia.iniciar();
    return vigilancia;
}

/**
 * Prepara la ejecución de los servicios contra el emulador de Pub/Sub local (`devel -p`): da de alta la topología declarada,
 * da a cada servicio las variables de entorno del emulador y deja una vigilancia que la repone —también antes de reiniciar
 * un servicio caído—.
 *
 * Falla hacia el lado seguro: si el repo no declara nada, el emulador no está levantado o una declaración no es válida,
 * devuelve `false` y no toca ningún servicio, de modo que ninguno acaba hablando con Google Cloud. Quien llama no debe
 * lanzar nada en ese caso.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param servicios - Servicios ya creados y todavía sin lanzar.
 * @returns `true` si el emulador está listo y los servicios configurados; `false` si no (el error ya se ha mostrado).
 */
export async function prepararEjecucion(basedir: string, servicios: IServicioPubSub[]): Promise<boolean> {
    const log = {type: Log.label_pubsub, label: "devel"};
    try {
        if (!await hayDeclaraciones(basedir)) {
            Log.error(log, `${MENSAJE_SIN_DECLARACIONES}: usa "Ejecutar"`);
            return false;
        }

        const sesion = await preparar(basedir);
        const vigilancia = vigilar(basedir, sesion);
        for (const servicio of servicios) {
            servicio.setEntorno(sesion.entorno);
            servicio.setAntesDeReiniciar(() => vigilancia.reponer());
        }
        return true;
    } catch (err) {
        Log.error(log, mensajeError(err));
        Log.error(log, "No se lanza ningún servicio: con -p nunca se ejecuta contra Google Cloud.");
        return false;
    }
}
