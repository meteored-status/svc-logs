/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: d1549fda330de80fbbca5392d4519bf1
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import type {IConfigEmulador} from "./config.ts";
import type {ISuscripcionEmulador, ISuscripcionTopologia, ITopologia} from "./declaracion.ts";
import {compararSuscripcion, describirDiferencias, endpointPush} from "./declaracion.ts";

/**
 * Qué hace {@link EmuladorPubSub.aplicar} con lo que ya existe y difiere de la topología.
 *
 * - `arranque`   — lo corrige: modifica el endpoint push o recrea la suscripción.
 * - `vigilancia` — solo crea lo que falta; las diferencias las informa sin tocarlas. Es la que usa `devel -p` con los
 *   servicios ya en marcha, donde recrear una suscripción les quitaría los mensajes en vuelo.
 */
export type TModoAplicar = "arranque" | "vigilancia";

/**
 * Qué se hizo con un recurso en {@link EmuladorPubSub.aplicar}.
 */
export type TAccionAplicar = "creado" | "existia" | "push-actualizado" | "recreado" | "difiere";

/**
 * Estado de un recurso declarado en {@link EmuladorPubSub.estado}.
 */
export type TEstadoRecurso = "ok" | "falta" | "difiere";

/**
 * Recurso del informe de {@link EmuladorPubSub.aplicar}.
 *
 * @property tipo - Topic o suscripción.
 * @property nombre - Nombre del recurso.
 * @property workspace - Quién lo declara: el workspace (varios, separados por coma, en un topic con varios publicadores)
 *   o `(deducido)` si es un topic que solo aparece en una suscripción.
 * @property accion - Qué se hizo.
 * @property detalle - En qué difiere, si la acción es `push-actualizado`, `recreado` o `difiere`.
 */
export interface IInformeRecurso {
    tipo: "topic" | "suscripcion";
    nombre: string;
    workspace: string;
    accion: TAccionAplicar;
    detalle?: string;
}

/**
 * Informe de {@link EmuladorPubSub.aplicar}. No se escribe en ningún log: lo hace quien llama.
 *
 * @property recursos - Un elemento por recurso de la topología, topics primero.
 */
export interface IInformeAplicar {
    recursos: IInformeRecurso[];
}

/**
 * Recurso declarado en el informe de {@link EmuladorPubSub.estado}.
 *
 * @property tipo - Topic o suscripción.
 * @property nombre - Nombre del recurso.
 * @property workspace - Quién lo declara (ver {@link IInformeRecurso.workspace}).
 * @property estado - `ok`, `falta` en el emulador, o `difiere` de lo declarado.
 * @property detalle - En qué difiere, si el estado es `difiere`.
 */
export interface IEstadoRecurso {
    tipo: "topic" | "suscripcion";
    nombre: string;
    workspace: string;
    estado: TEstadoRecurso;
    detalle?: string;
}

/**
 * Recurso del emulador que no está en la topología.
 *
 * @property tipo - Topic o suscripción.
 * @property nombre - Nombre del recurso.
 * @property repo - Valor de su label `mrpack-repo`, si lo tiene: quién lo creó. Sin label, el recurso lo creó otra cosa
 *   (otra herramienta, a mano) y `mrpack` nunca lo toca.
 * @property propio - `true` si lo creó este repo, y por tanto lo borraría {@link EmuladorPubSub.limpiar}.
 */
export interface IExtraEmulador {
    tipo: "topic" | "suscripcion";
    nombre: string;
    repo?: string;
    propio: boolean;
}

/**
 * Informe de {@link EmuladorPubSub.estado}.
 *
 * @property recursos - Los recursos declarados y cómo están.
 * @property extras - Lo que hay en el emulador y no está declarado.
 */
export interface IInformeEstado {
    recursos: IEstadoRecurso[];
    extras: IExtraEmulador[];
}

/**
 * Opciones de una petición REST al emulador.
 *
 * @property cuerpo - Cuerpo JSON, si lo hay.
 * @property aceptados - Estados que no se consideran un error aparte de los 2xx (409 al crear algo que ya existe, 404 al
 *   borrar algo que no existe).
 */
interface IPeticionConfig {
    cuerpo?: unknown;
    aceptados?: number[];
}

/**
 * Datos que el emulador devuelve de un topic (los que usa `mrpack`).
 */
interface ITopicRest {
    name: string;
    labels?: Record<string, string>;
}

/**
 * Datos que el emulador devuelve de una suscripción (los que usa `mrpack`).
 */
interface ISuscripcionRest {
    name: string;
    topic: string;
    filter?: string;
    pushConfig?: {pushEndpoint?: string};
    ackDeadlineSeconds?: number;
    labels?: Record<string, string>;
}

/**
 * Topic con sus labels.
 */
interface ITopicEmulador {
    nombre: string;
    labels: Record<string, string>;
}

const TIMEOUT_MS = 10_000;
const TIMEOUT_DISPONIBLE_MS = 5_000;
const ACK_DEADLINE_DEFECTO = 10;
const LABEL_REPO = "mrpack-repo";
const LABEL_WORKSPACE = "mrpack-workspace";
const DEDUCIDO = "(deducido)";

function nombreCorto(recurso: string): string {
    return recurso.slice(recurso.lastIndexOf("/") + 1);
}

/**
 * Valor válido de una label de GCP: minúsculas, solo `[a-z0-9_-]` y 63 caracteres como mucho. La `/` pasa a `_`
 * (`services/amateur` -> `services_amateur`) y cualquier otro carácter no admitido, también.
 */
function sanear(valor: string): string {
    return valor.toLowerCase().replaceAll("/", "_").replace(/[^a-z0-9_-]/g, "_").slice(0, 63);
}

/**
 * Mensaje para cuando el emulador no está levantado.
 *
 * @param host - `host:puerto` en el que se buscó.
 * @returns El mensaje, listo para mostrar a la persona.
 */
export function mensajeEmuladorCaido(host: string): string {
    return `No se ha encontrado levantado el docker de Pub/Sub en ${host} (servicio \`pubsub\` de mrenv). Levántalo y vuelve a lanzar.`;
}

/**
 * Cliente del emulador de Pub/Sub contra el que corre el entorno de desarrollo, y el que materializa en él la
 * topología declarada en los `mrpack.pubsub.ts`.
 *
 * Habla con el emulador por su API REST, sin ninguna librería de Google: los servicios son los únicos que usan
 * `@google-cloud/pubsub`, y lo hacen con `PUBSUB_EMULATOR_HOST` y `PUBSUB_PROJECT_ID` (ver {@link entorno}).
 *
 * **Nunca toca un recurso que no esté en la topología** que se le pasa, salvo {@link limpiar}, que solo borra los que
 * llevan la label `mrpack-repo` de este repo. Cada topic y cada suscripción que crea lleva dos labels:
 * `mrpack-repo` (el repo, saneado) y `mrpack-workspace` (quién lo declara), salvo los topics deducidos (los que nadie
 * declara en `topics`), que se crean sin labels: pueden ser de otro repo y {@link limpiar} no debe borrarlos. El
 * emulador conserva las labels en `GET` y `list` (medido contra el emulador de mrenv), y de ahí salen la columna
 * «dueño» de {@link estado} y el alcance de {@link limpiar}. Lo que ya existía sin label —creado por otra
 * herramienta— queda fuera de las dos.
 */
export class EmuladorPubSub {
    /* STATIC */

    /**
     * @param config - Datos de conexión (ver `resolverConfigEmulador`).
     */
    public static build(config: IConfigEmulador): EmuladorPubSub {
        return new EmuladorPubSub(config);
    }

    /* INSTANCE */

    public readonly config: IConfigEmulador;

    /**
     * Variables de entorno que apuntan un proceso a este emulador. Solo las inyecta `mrpack devel -p` en los procesos
     * que lanza: el arranque normal de los servicios no las ve, y no deben escribirse en código ni en ficheros versionados.
     */
    public get entorno(): Record<string, string> {
        return {
            PUBSUB_EMULATOR_HOST: this.config.host,
            PUBSUB_PROJECT_ID: this.config.proyecto,
        };
    }

    private constructor(config: IConfigEmulador) {
        this.config = config;
    }

    /**
     * Comprueba que el emulador responde: `GET /` devuelve `Ok`.
     *
     * @returns `true` si está levantado.
     */
    public async disponible(): Promise<boolean> {
        try {
            const respuesta = await fetch(`http://${this.config.host}/`, {signal: AbortSignal.timeout(TIMEOUT_DISPONIBLE_MS)});
            if (!respuesta.ok) {
                await respuesta.body?.cancel();
                return false;
            }
            return (await respuesta.text()).trim() === "Ok";
        } catch {
            return false;
        }
    }

    /**
     * Lista todo lo que hay en el emulador, sea de quien sea.
     *
     * @returns Nombres de los topics y suscripciones completas.
     */
    public async listar(): Promise<{topics: string[]; suscripciones: ISuscripcionEmulador[]}> {
        const [topics, suscripciones] = await Promise.all([this.listarTopics(), this.listarSuscripciones()]);
        return {topics: topics.map(({nombre}) => nombre), suscripciones};
    }

    /**
     * Da de alta la topología en el emulador.
     *
     * Los topics se crean si faltan; los que nadie declara en `topics` (deducidos de una suscripción) se crean sin la
     * label `mrpack-repo`, para que {@link limpiar} de un repo no borre un topic que puede ser de otro. Con las
     * suscripciones:
     * - Si faltan, se crean.
     * - Si existen y son iguales, no se hace nada.
     * - Si existen y difieren, en modo `arranque` se corrigen —`modifyPushConfig` si solo difiere el endpoint push;
     *   `DELETE` + `PUT` si difiere el topic, el filtro o el `ackDeadline`, lo que descarta sus mensajes pendientes— y en
     *   modo `vigilancia` se informan sin tocarlas. Tampoco se tocan, en ningún modo, las que llevan la label
     *   `mrpack-repo` de **otro** repo: se informan `difiere` con «declarada también por el repo X».
     * - Si el emulador responde 409 al crearlas, otro proceso (otra instancia de `devel -p`, `pubsub -r`) las ha creado
     *   entre medias: se vuelven a leer y se comparan, sin recrearlas (`existia` si son iguales, `difiere` si no).
     *
     * No escribe en ningún log; devuelve el informe y lo muestra quien llama. Es idempotente.
     *
     * @param topologia - Topología fusionada (`fusionar`).
     * @param config - `modo`: ver {@link TModoAplicar}. `repo`: repo al que se asignan los recursos que se creen (label `mrpack-repo`).
     * @returns Qué se hizo con cada recurso.
     * @throws {Error} Si el emulador rechaza alguna petición o no responde.
     */
    public async aplicar(topologia: ITopologia, {modo, repo}: {modo: TModoAplicar; repo: string}): Promise<IInformeAplicar> {
        const recursos: IInformeRecurso[] = [];

        for (const topic of topologia.topics) {
            const estado = await this.sinCuerpo("PUT", `topics/${encodeURIComponent(topic.nombre)}`, {
                cuerpo: topic.deducido ? {} : {labels: this.etiquetas(topic.declaradoPor[0] ?? DEDUCIDO, repo)},
                aceptados: [409],
            });
            recursos.push({
                tipo: "topic",
                nombre: topic.nombre,
                workspace: topic.declaradoPor.join(", ") || DEDUCIDO,
                accion: estado === 409 ? "existia" : "creado",
            });
        }

        const propio = sanear(repo);
        const existentes = new Map((await this.listarSuscripciones()).map((suscripcion) => [suscripcion.nombre, suscripcion]));
        for (const suscripcion of topologia.suscripciones) {
            const existente = existentes.get(suscripcion.nombre);
            const base = {tipo: "suscripcion" as const, nombre: suscripcion.nombre, workspace: suscripcion.consumidor};
            if (existente === undefined) {
                if (await this.crearSuscripcion(suscripcion, repo)) {
                    recursos.push({...base, accion: "creado"});
                } else {
                    recursos.push({...base, ...await this.resolverConflicto(suscripcion, propio)});
                }
                continue;
            }

            const comparacion = compararSuscripcion(suscripcion, existente, this.config);
            if (comparacion === "igual") {
                recursos.push({...base, accion: "existia"});
                continue;
            }

            const detalle = this.detalleDiferencias(suscripcion, existente, propio);
            if (modo === "vigilancia" || this.dueno(existente, propio) !== undefined) {
                recursos.push({...base, accion: "difiere", detalle});
            } else if (comparacion === "push") {
                await this.sinCuerpo("POST", `subscriptions/${encodeURIComponent(suscripcion.nombre)}:modifyPushConfig`, {cuerpo: {
                    pushConfig: suscripcion.push !== undefined ? {pushEndpoint: endpointPush(suscripcion.push, this.config.pushHost)} : {},
                }});
                recursos.push({...base, accion: "push-actualizado", detalle});
            } else {
                await this.sinCuerpo("DELETE", `subscriptions/${encodeURIComponent(suscripcion.nombre)}`, {aceptados: [404]});
                if (await this.crearSuscripcion(suscripcion, repo)) {
                    recursos.push({...base, accion: "recreado", detalle});
                } else {
                    recursos.push({...base, ...await this.resolverConflicto(suscripcion, propio)});
                }
            }
        }

        return {recursos};
    }

    /**
     * Compara la topología con lo que hay en el emulador, sin tocar nada.
     *
     * @param topologia - Topología fusionada.
     * @param config - `repo`: repo al que se atribuyen los extras con su label.
     * @returns El estado de cada recurso declarado y, aparte, lo que hay en el emulador y no está declarado.
     */
    public async estado(topologia: ITopologia, {repo}: {repo: string}): Promise<IInformeEstado> {
        const [topics, suscripciones] = await Promise.all([this.listarTopics(), this.listarSuscripciones()]);
        const topicsExistentes = new Set(topics.map(({nombre}) => nombre));
        const suscripcionesExistentes = new Map(suscripciones.map((suscripcion) => [suscripcion.nombre, suscripcion]));
        const recursos: IEstadoRecurso[] = [];

        for (const topic of topologia.topics) {
            recursos.push({
                tipo: "topic",
                nombre: topic.nombre,
                workspace: topic.declaradoPor.join(", ") || DEDUCIDO,
                estado: topicsExistentes.has(topic.nombre) ? "ok" : "falta",
            });
        }
        for (const suscripcion of topologia.suscripciones) {
            const existente = suscripcionesExistentes.get(suscripcion.nombre);
            const base = {tipo: "suscripcion" as const, nombre: suscripcion.nombre, workspace: suscripcion.consumidor};
            if (existente === undefined) {
                recursos.push({...base, estado: "falta"});
            } else if (compararSuscripcion(suscripcion, existente, this.config) === "igual") {
                recursos.push({...base, estado: "ok"});
            } else {
                recursos.push({...base, estado: "difiere", detalle: describirDiferencias(suscripcion, existente, this.config).join("; ")});
            }
        }

        const propio = sanear(repo);
        const declaradosTopics = new Set(topologia.topics.map(({nombre}) => nombre));
        const declaradasSuscripciones = new Set(topologia.suscripciones.map(({nombre}) => nombre));
        const extras: IExtraEmulador[] = [];
        for (const topic of topics.filter(({nombre}) => !declaradosTopics.has(nombre))) {
            extras.push(this.extra("topic", topic.nombre, topic.labels, propio));
        }
        for (const suscripcion of suscripciones.filter(({nombre}) => !declaradasSuscripciones.has(nombre))) {
            extras.push(this.extra("suscripcion", suscripcion.nombre, suscripcion.labels, propio));
        }

        return {recursos, extras};
    }

    /**
     * Borra y recrea unas suscripciones con su configuración declarada, para descartar los mensajes pendientes.
     *
     * Los topics tienen que existir ya (`aplicar`). Tocar solo las que se pasan es lo que permite a una suite
     * limpiar las suyas sin quitar los mensajes a las del resto. Si al recrearla el emulador responde 409, otro proceso
     * ya la recreó, vacía como acaba de quedar la nuestra: se da por buena.
     *
     * @param suscripciones - Suscripciones de la topología a purgar.
     * @param config - `repo`: repo al que se asignan al recrearlas.
     * @throws {Error} Si el emulador rechaza alguna petición o no responde.
     */
    public async purgar(suscripciones: ISuscripcionTopologia[], {repo}: {repo: string}): Promise<void> {
        for (const suscripcion of suscripciones) {
            await this.sinCuerpo("DELETE", `subscriptions/${encodeURIComponent(suscripcion.nombre)}`, {aceptados: [404]});
            await this.crearSuscripcion(suscripcion, repo);
        }
    }

    /**
     * Borra lo que este repo creó y ya no está en la topología.
     *
     * Solo toca recursos con la label `mrpack-repo` igual a la de este repo: las suscripciones que ya no están
     * declaradas y, después, los topics que ya no están declarados y se quedan sin suscripciones. Lo que se creó sin
     * label (a mano, con otra herramienta) o con la de otro repo no se toca nunca.
     *
     * @param topologia - Topología fusionada vigente.
     * @param config - `repo`: repo cuyos recursos se limpian.
     * @returns Lo borrado, como `suscripcion <nombre>` y `topic <nombre>`.
     * @throws {Error} Si el emulador rechaza alguna petición o no responde.
     */
    public async limpiar(topologia: ITopologia, {repo}: {repo: string}): Promise<string[]> {
        const propio = sanear(repo);
        const declaradosTopics = new Set(topologia.topics.map(({nombre}) => nombre));
        const declaradasSuscripciones = new Set(topologia.suscripciones.map(({nombre}) => nombre));
        const [topics, suscripciones] = await Promise.all([this.listarTopics(), this.listarSuscripciones()]);
        const borrado: string[] = [];

        const sobrantes = suscripciones.filter((suscripcion) => suscripcion.labels[LABEL_REPO] === propio && !declaradasSuscripciones.has(suscripcion.nombre));
        for (const suscripcion of sobrantes) {
            await this.sinCuerpo("DELETE", `subscriptions/${encodeURIComponent(suscripcion.nombre)}`, {aceptados: [404]});
            borrado.push(`suscripcion ${suscripcion.nombre}`);
        }

        const restantes = new Set(suscripciones.filter((suscripcion) => !sobrantes.includes(suscripcion)).map(({topic}) => topic));
        for (const topic of topics) {
            if (topic.labels[LABEL_REPO] === propio && !declaradosTopics.has(topic.nombre) && !restantes.has(topic.nombre)) {
                await this.sinCuerpo("DELETE", `topics/${encodeURIComponent(topic.nombre)}`, {aceptados: [404]});
                borrado.push(`topic ${topic.nombre}`);
            }
        }

        return borrado;
    }

    /**
     * Publica un mensaje JSON en un topic, igual que lo haría el servicio.
     *
     * @param topic - Topic destino.
     * @param mensaje - Cuerpo; se serializa como JSON.
     * @param attributes - Atributos del mensaje.
     * @returns Id del mensaje publicado.
     * @throws {Error} Si el emulador rechaza la publicación (p. ej. el topic no existe) o no devuelve el id.
     */
    public async publicar(topic: string, mensaje: unknown, attributes?: Record<string, string>): Promise<string> {
        const respuesta = await this.peticion("POST", `topics/${encodeURIComponent(topic)}:publish`, {cuerpo: {
            messages: [{
                data: Buffer.from(JSON.stringify(mensaje), "utf8").toString("base64"),
                ...(attributes !== undefined ? {attributes} : {}),
            }],
        }});
        const salida = await respuesta.json() as {messageIds?: string[]};
        const id = salida.messageIds?.[0];
        if (id === undefined) {
            throw new Error(`POST topics/${topic}:publish: el emulador no devolvió el id del mensaje`);
        }
        return id;
    }

    private etiquetas(workspace: string, repo: string): Record<string, string> {
        return {[LABEL_REPO]: sanear(repo), [LABEL_WORKSPACE]: sanear(workspace)};
    }

    private extra(tipo: "topic" | "suscripcion", nombre: string, labels: Record<string, string>, propio: string): IExtraEmulador {
        const repo = labels[LABEL_REPO];
        return {tipo, nombre, ...(repo !== undefined ? {repo} : {}), propio: repo === propio};
    }

    /**
     * Crea una suscripción con su configuración declarada.
     *
     * @returns `true` si la creó; `false` si el emulador respondió 409 porque ya existía.
     */
    private async crearSuscripcion(suscripcion: ISuscripcionTopologia, repo: string): Promise<boolean> {
        const {topic, filtro, push, ackDeadline} = suscripcion;
        const estado = await this.sinCuerpo("PUT", `subscriptions/${encodeURIComponent(suscripcion.nombre)}`, {
            cuerpo: {
                topic: `projects/${this.config.proyecto}/topics/${topic}`,
                ...(filtro !== undefined ? {filter: filtro} : {}),
                ...(push !== undefined ? {pushConfig: {pushEndpoint: endpointPush(push, this.config.pushHost)}} : {}),
                ...(ackDeadline !== undefined ? {ackDeadlineSeconds: ackDeadline} : {}),
                labels: this.etiquetas(suscripcion.consumidor, repo),
            },
            aceptados: [409],
        });
        return estado !== 409;
    }

    /**
     * Qué informar de una suscripción que no se pudo crear porque otro proceso se adelantó (409): la vuelve a leer y la
     * compara con la declarada, sin recrearla.
     *
     * @throws {Error} Si ya no existe: alguien la creó y la borró otra vez entre las dos peticiones.
     */
    private async resolverConflicto(suscripcion: ISuscripcionTopologia, propio: string): Promise<{accion: TAccionAplicar; detalle?: string}> {
        const actual = await this.leerSuscripcion(suscripcion.nombre);
        if (actual === undefined) {
            throw new Error(`PUT subscriptions/${suscripcion.nombre}: el emulador respondió 409 y la suscripción ya no existe (otro proceso la ha creado y borrado)`);
        }
        if (compararSuscripcion(suscripcion, actual, this.config) === "igual") {
            return {accion: "existia"};
        }
        return {accion: "difiere", detalle: this.detalleDiferencias(suscripcion, actual, propio)};
    }

    /**
     * El repo de otro dueño de una suscripción: su label `mrpack-repo`, si existe y no es la de `propio`.
     */
    private dueno(existente: ISuscripcionEmulador, propio: string): string | undefined {
        const repo = existente.labels[LABEL_REPO];
        return repo !== undefined && repo !== propio ? repo : undefined;
    }

    private detalleDiferencias(declarada: ISuscripcionTopologia, existente: ISuscripcionEmulador, propio: string): string {
        const diferencias = describirDiferencias(declarada, existente, this.config).join("; ");
        const dueno = this.dueno(existente, propio);
        return dueno !== undefined ? `declarada también por el repo ${dueno}: ${diferencias}` : diferencias;
    }

    /**
     * Lee una suscripción.
     *
     * @returns La suscripción, o `undefined` si no existe.
     */
    private async leerSuscripcion(nombre: string): Promise<ISuscripcionEmulador | undefined> {
        const respuesta = await this.peticion("GET", `subscriptions/${encodeURIComponent(nombre)}`, {aceptados: [404]});
        if (respuesta.status === 404) {
            await respuesta.body?.cancel();
            return undefined;
        }
        return this.aSuscripcion(await respuesta.json() as ISuscripcionRest);
    }

    private aSuscripcion(suscripcion: ISuscripcionRest): ISuscripcionEmulador {
        return {
            nombre: nombreCorto(suscripcion.name),
            topic: nombreCorto(suscripcion.topic),
            ...(suscripcion.filter ? {filtro: suscripcion.filter} : {}),
            ...(suscripcion.pushConfig?.pushEndpoint ? {pushEndpoint: suscripcion.pushConfig.pushEndpoint} : {}),
            ackDeadline: suscripcion.ackDeadlineSeconds ?? ACK_DEADLINE_DEFECTO,
            labels: suscripcion.labels ?? {},
        };
    }

    /**
     * Petición de la que solo interesa el estado: descarta el cuerpo para no dejar la conexión retenida.
     *
     * @returns El estado HTTP (un 2xx o uno de los aceptados).
     */
    private async sinCuerpo(metodo: string, recurso: string, config: IPeticionConfig = {}): Promise<number> {
        const respuesta = await this.peticion(metodo, recurso, config);
        await respuesta.body?.cancel();
        return respuesta.status;
    }

    private async listarTopics(): Promise<ITopicEmulador[]> {
        const topics: ITopicEmulador[] = [];
        let pagina: string | undefined;
        do {
            const respuesta = await this.peticion("GET", `topics${pagina !== undefined ? `?pageToken=${encodeURIComponent(pagina)}` : ""}`);
            const salida = await respuesta.json() as {topics?: ITopicRest[]; nextPageToken?: string};
            for (const topic of salida.topics ?? []) {
                topics.push({nombre: nombreCorto(topic.name), labels: topic.labels ?? {}});
            }
            pagina = salida.nextPageToken || undefined;
        } while (pagina !== undefined);
        return topics;
    }

    private async listarSuscripciones(): Promise<ISuscripcionEmulador[]> {
        const suscripciones: ISuscripcionEmulador[] = [];
        let pagina: string | undefined;
        do {
            const respuesta = await this.peticion("GET", `subscriptions${pagina !== undefined ? `?pageToken=${encodeURIComponent(pagina)}` : ""}`);
            const salida = await respuesta.json() as {subscriptions?: ISuscripcionRest[]; nextPageToken?: string};
            for (const suscripcion of salida.subscriptions ?? []) {
                suscripciones.push(this.aSuscripcion(suscripcion));
            }
            pagina = salida.nextPageToken || undefined;
        } while (pagina !== undefined);
        return suscripciones;
    }

    /**
     * Petición REST al emulador.
     *
     * @param metodo - Método HTTP.
     * @param recurso - Recurso relativo al proyecto (`topics/x`, `subscriptions/y`, `topics/x:publish`).
     * @param config - Cuerpo y estados aceptados.
     * @returns La respuesta.
     * @throws {Error} Si el emulador no responde, o responde con un estado que no es 2xx ni uno de los aceptados; el
     *   mensaje lleva el método, el recurso, el estado y el cuerpo.
     */
    private async peticion(metodo: string, recurso: string, {cuerpo, aceptados = []}: IPeticionConfig = {}): Promise<Response> {
        let respuesta: Response;
        try {
            respuesta = await fetch(`http://${this.config.host}/v1/projects/${this.config.proyecto}/${recurso}`, {
                method: metodo,
                headers: {"Content-Type": "application/json"},
                body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
        } catch (err) {
            throw new Error(`${metodo} ${recurso}: el emulador de Pub/Sub en ${this.config.host} no responde (${err instanceof Error ? err.message : String(err)})`, {cause: err});
        }

        if (!respuesta.ok && !aceptados.includes(respuesta.status)) {
            throw new Error(`${metodo} ${recurso}: el emulador de Pub/Sub respondió HTTP ${respuesta.status}: ${await respuesta.text()}`);
        }
        return respuesta;
    }
}
