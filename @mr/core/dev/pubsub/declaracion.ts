/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 04983de2f8a3d6546d4273a2aab1b7c5
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

/**
 * Declaración de la topología local de Pub/Sub: cada workspace describe en un `mrpack.pubsub.ts` en su raíz los topics
 * que publica y las suscripciones que consume, `mrpack` los fusiona y los da de alta en el emulador.
 *
 * Este módulo es **puro**: no importa nada de Node. Lo empaqueta esbuild dentro de cada declaración (el
 * `mrpack.pubsub.ts` importa `definirPubSub` de aquí) y lo usan además `@mr/cli` y los tests, así que tiene que
 * poder evaluarse en cualquier sitio. Lo que toca el disco (`descubrir.ts`, `config.ts`) o la red (`emulador.ts`)
 * vive en sus propios ficheros.
 */

/**
 * Nombre del fichero de declaración, en la raíz de cada workspace.
 */
export const FICHERO_DECLARACION = "mrpack.pubsub.ts";

/**
 * Entrega push de una suscripción.
 *
 * @property base - Origen del servicio que recibe la entrega, con protocolo y puerto explícitos (normalmente
 *   `SERVICES.servicio(EService.x).base`). De aquí solo se toman protocolo y puerto: el host lo sustituye `pushHost`
 *   (ver {@link endpointPush}) porque el emulador corre en un docker y no llega al `localhost` de la máquina.
 * @property ruta - Ruta del endpoint; tiene que empezar por `/`. Por defecto, `/`.
 */
export interface IPushDeclarado {
    base: string;
    ruta?: string;
}

/**
 * Suscripción declarada por un workspace.
 *
 * @property nombre - Nombre de la suscripción (sin el prefijo `projects/<p>/subscriptions/`).
 * @property topic - Nombre del topic del que cuelga (sin prefijo).
 * @property filtro - Filtro de Pub/Sub sobre los atributos del mensaje. No puede ser una cadena vacía.
 * @property push - Si se define, la entrega es push contra ese endpoint; si no, es pull.
 * @property ackDeadline - Segundos que el emulador espera el ack antes de reentregar: entero entre 10 y 600. Por
 *   defecto, 10, que es el del propio emulador.
 */
export interface ISuscripcionDeclarada {
    nombre: string;
    topic: string;
    filtro?: string;
    push?: IPushDeclarado;
    ackDeadline?: number;
}

/**
 * Contenido de un `mrpack.pubsub.ts`.
 *
 * @property topics - Topics que publica el workspace.
 * @property suscripciones - Suscripciones que consume el workspace. Si cuelgan de un topic que nadie declara, el topic
 *   se crea igualmente (ver {@link ITopicTopologia.deducido}).
 */
export interface IDeclaracionPubSub {
    topics?: string[];
    suscripciones?: ISuscripcionDeclarada[];
}

/**
 * Declaración de un workspace concreto, tal y como sale de `pubsub/evaluar.mjs`.
 *
 * @property workspace - Ruta del workspace relativa a la raíz del monorepo (p. ej. `services/amateur`).
 * @property declaracion - Lo que exporta su `mrpack.pubsub.ts`.
 */
export interface IDeclaracionWorkspace {
    workspace: string;
    declaracion: IDeclaracionPubSub;
}

/**
 * Topic de la topología fusionada.
 *
 * @property nombre - Nombre del topic.
 * @property declaradoPor - Workspaces que lo declaran en `topics`, ordenados. Varios publicadores son válidos.
 * @property deducido - `true` si nadie lo declara en `topics` y solo aparece como topic de alguna suscripción.
 */
export interface ITopicTopologia {
    nombre: string;
    declaradoPor: string[];
    deducido: boolean;
}

/**
 * Suscripción de la topología fusionada.
 *
 * @property consumidor - Workspace que la declara. Cada suscripción tiene un único consumidor.
 */
export interface ISuscripcionTopologia extends ISuscripcionDeclarada {
    consumidor: string;
}

/**
 * Topología completa del monorepo: la unión de las declaraciones de todos los workspaces.
 *
 * @property topics - Topics, por orden alfabético.
 * @property suscripciones - Suscripciones, por orden alfabético.
 */
export interface ITopologia {
    topics: ITopicTopologia[];
    suscripciones: ISuscripcionTopologia[];
}

/**
 * Suscripción tal y como la devuelve el emulador.
 *
 * @property nombre - Nombre corto de la suscripción.
 * @property topic - Nombre corto del topic.
 * @property filtro - Filtro, si lo tiene.
 * @property pushEndpoint - Endpoint de la entrega push; ausente si es pull.
 * @property ackDeadline - Segundos de espera del ack.
 * @property labels - Etiquetas del recurso (`mrpack-repo`, `mrpack-workspace`).
 */
export interface ISuscripcionEmulador {
    nombre: string;
    topic: string;
    filtro?: string;
    pushEndpoint?: string;
    ackDeadline: number;
    labels: Record<string, string>;
}

/**
 * Datos del emulador que necesita {@link compararSuscripcion}.
 *
 * @property proyecto - Proyecto del emulador; sirve para reconocer un topic dado como ruta completa.
 * @property pushHost - Host por el que el emulador llega a la máquina (ver {@link endpointPush}).
 */
export interface IConfigComparacion {
    proyecto: string;
    pushHost: string;
}

/**
 * Resultado de comparar una suscripción declarada con la que hay en el emulador.
 *
 * - `igual`   — no hay nada que cambiar.
 * - `push`    — solo difiere el endpoint push; se corrige sin recrearla.
 * - `recrear` — difiere algo que el emulador no deja modificar (topic, filtro o `ackDeadline`).
 */
export type TComparacionSuscripcion = "igual" | "push" | "recrear";

/**
 * Nombre válido de un recurso de Pub/Sub: empieza por letra, de 3 a 255 caracteres de `[A-Za-z0-9-_.~+%]`.
 */
const NOMBRE_VALIDO = /^[A-Za-z][A-Za-z0-9\-_.~+%]{2,254}$/;

/**
 * Protocolo http(s) y puerto escrito explícitamente: `new URL` descarta el puerto por defecto, así que no sirve
 * para saber si se escribió.
 */
const BASE_CON_PUERTO = /^https?:\/\/(?:\[[0-9a-fA-F:.]+\]|[^\s/:?#@[\]]+):(\d{1,5})(?=[/?#]|$)/i;

/**
 * `ackDeadline` del emulador cuando la suscripción no lo fija.
 */
const ACK_DEADLINE_DEFECTO = 10;

const ACK_DEADLINE_MINIMO = 10;
const ACK_DEADLINE_MAXIMO = 600;
const CLAVES_DECLARACION = ["topics", "suscripciones"];
const CLAVES_SUSCRIPCION = ["nombre", "topic", "filtro", "push", "ackDeadline"];
const CLAVES_PUSH = ["base", "ruta"];

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function fallo(origen: string, ruta: string, motivo: string): Error {
    return new Error(`${origen}: ${ruta}: ${motivo}`);
}

function comparar(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    return a > b ? 1 : 0;
}

function comprobarClaves(valor: Record<string, unknown>, permitidas: string[], ruta: string, origen: string): void {
    for (const clave of Object.keys(valor)) {
        if (!permitidas.includes(clave)) {
            throw fallo(origen, ruta, `clave desconocida "${clave}" (admitidas: ${permitidas.join(", ")})`);
        }
    }
}

function validarNombre(valor: unknown, ruta: string, origen: string): string {
    if (typeof valor !== "string") {
        throw fallo(origen, ruta, "debe ser una cadena");
    }
    if (!NOMBRE_VALIDO.test(valor)) {
        throw fallo(origen, ruta, `"${valor}" no es un nombre válido de recurso de Pub/Sub (3 a 255 caracteres de A-Z a-z 0-9 - _ . ~ + %, empezando por una letra)`);
    }
    if (valor.startsWith("goog")) {
        throw fallo(origen, ruta, `"${valor}" no es válido: los nombres de recursos de Pub/Sub no pueden empezar por "goog"`);
    }
    return valor;
}

function validarBase(valor: unknown, ruta: string, origen: string): string {
    if (typeof valor !== "string") {
        throw fallo(origen, ruta, "debe ser una cadena");
    }
    const puerto = BASE_CON_PUERTO.exec(valor)?.[1];
    if (puerto === undefined) {
        throw fallo(origen, ruta, `"${valor}" no es una URL http/https con puerto explícito (p. ej. "http://localhost:8080")`);
    }
    try {
        new URL(valor);
    } catch {
        throw fallo(origen, ruta, `"${valor}" no es una URL válida`);
    }
    const numero = Number(puerto);
    if (numero < 1 || numero > 65535) {
        throw fallo(origen, ruta, `el puerto ${puerto} de "${valor}" está fuera de rango (1 a 65535)`);
    }
    return valor;
}

function validarPush(valor: unknown, ruta: string, origen: string): IPushDeclarado {
    if (!esObjeto(valor)) {
        throw fallo(origen, ruta, "debe ser un objeto {base, ruta?}");
    }
    comprobarClaves(valor, CLAVES_PUSH, ruta, origen);
    const push: IPushDeclarado = {base: validarBase(valor["base"], `${ruta}.base`, origen)};
    const rutaPush = valor["ruta"];
    if (rutaPush !== undefined) {
        if (typeof rutaPush !== "string" || !rutaPush.startsWith("/")) {
            throw fallo(origen, `${ruta}.ruta`, `debe ser una cadena que empiece por "/" (se recibió ${JSON.stringify(rutaPush)})`);
        }
        push.ruta = rutaPush;
    }
    return push;
}

function validarSuscripcion(valor: unknown, ruta: string, origen: string): ISuscripcionDeclarada {
    if (!esObjeto(valor)) {
        throw fallo(origen, ruta, "debe ser un objeto {nombre, topic, filtro?, push?, ackDeadline?}");
    }
    comprobarClaves(valor, CLAVES_SUSCRIPCION, ruta, origen);
    const suscripcion: ISuscripcionDeclarada = {
        nombre: validarNombre(valor["nombre"], `${ruta}.nombre`, origen),
        topic: validarNombre(valor["topic"], `${ruta}.topic`, origen),
    };
    const filtro = valor["filtro"];
    if (filtro !== undefined) {
        if (typeof filtro !== "string" || filtro.trim() === "") {
            throw fallo(origen, `${ruta}.filtro`, "debe ser una cadena no vacía (si no hay filtro, se omite)");
        }
        suscripcion.filtro = filtro;
    }
    if (valor["push"] !== undefined) {
        suscripcion.push = validarPush(valor["push"], `${ruta}.push`, origen);
    }
    const ackDeadline = valor["ackDeadline"];
    if (ackDeadline !== undefined) {
        if (typeof ackDeadline !== "number" || !Number.isInteger(ackDeadline) || ackDeadline < ACK_DEADLINE_MINIMO || ackDeadline > ACK_DEADLINE_MAXIMO) {
            throw fallo(origen, `${ruta}.ackDeadline`, `debe ser un entero entre ${ACK_DEADLINE_MINIMO} y ${ACK_DEADLINE_MAXIMO} (se recibió ${JSON.stringify(ackDeadline)})`);
        }
        suscripcion.ackDeadline = ackDeadline;
    }
    return suscripcion;
}

function nombreCorto(topic: string, proyecto: string): string {
    const prefijo = `projects/${proyecto}/topics/`;
    return topic.startsWith(prefijo) ? topic.slice(prefijo.length) : topic;
}

/**
 * Comprueba que lo que exporta un `mrpack.pubsub.ts` tiene la forma y los valores que admite el emulador.
 *
 * Es estricta a propósito: una clave mal escrita (`topic` por `topics`, `ackdeadline`) se ignoraría en silencio y la
 * topología quedaría incompleta sin que nada avisara.
 *
 * @param valor - Lo que exporta el módulo, sin tipar.
 * @param origen - De dónde viene (el workspace o el fichero); va en el mensaje de cualquier error.
 * @returns La declaración ya tipada, sin las claves con valor `undefined`.
 * @throws {Error} Si hay claves desconocidas; un nombre de topic o de suscripción que no es un nombre válido de recurso
 *   de Pub/Sub; un `filtro` vacío; un `push.base` que no es una URL http/https con puerto explícito; una `push.ruta` que no
 *   empieza por `/`; un `ackDeadline` que no es un entero entre 10 y 600; o nombres repetidos dentro de la declaración.
 */
export function validarDeclaracion(valor: unknown, origen: string): IDeclaracionPubSub {
    if (!esObjeto(valor)) {
        throw fallo(origen, "declaración", "debe ser un objeto {topics?, suscripciones?}");
    }
    comprobarClaves(valor, CLAVES_DECLARACION, "declaración", origen);
    const declaracion: IDeclaracionPubSub = {};

    const topics = valor["topics"];
    if (topics !== undefined) {
        if (!Array.isArray(topics)) {
            throw fallo(origen, "topics", "debe ser una lista de nombres");
        }
        const vistos = new Set<string>();
        declaracion.topics = topics.map((topic: unknown, i) => {
            const nombre = validarNombre(topic, `topics[${i}]`, origen);
            if (vistos.has(nombre)) {
                throw fallo(origen, `topics[${i}]`, `el topic "${nombre}" está repetido`);
            }
            vistos.add(nombre);
            return nombre;
        });
    }

    const suscripciones = valor["suscripciones"];
    if (suscripciones !== undefined) {
        if (!Array.isArray(suscripciones)) {
            throw fallo(origen, "suscripciones", "debe ser una lista de suscripciones");
        }
        const vistas = new Set<string>();
        declaracion.suscripciones = suscripciones.map((item: unknown, i) => {
            const suscripcion = validarSuscripcion(item, `suscripciones[${i}]`, origen);
            if (vistas.has(suscripcion.nombre)) {
                throw fallo(origen, `suscripciones[${i}].nombre`, `la suscripción "${suscripcion.nombre}" está repetida`);
            }
            vistas.add(suscripcion.nombre);
            return suscripcion;
        });
    }

    return declaracion;
}

/**
 * Punto de entrada de un `mrpack.pubsub.ts`: valida la declaración y la devuelve tal cual, para que el fichero se
 * escriba como `export default definirPubSub({...})` y los errores salten al evaluarlo, no al darla de alta.
 *
 * @param declaracion - Topics que publica el workspace y suscripciones que consume.
 * @returns La misma declaración.
 * @throws {Error} Si no es válida (ver {@link validarDeclaracion}).
 */
export function definirPubSub(declaracion: IDeclaracionPubSub): IDeclaracionPubSub {
    validarDeclaracion(declaracion, FICHERO_DECLARACION);
    return declaracion;
}

/**
 * Fusiona las declaraciones de todos los workspaces en una sola topología.
 *
 * - Topics: los declarados en `topics` (con `declaradoPor` = todos los workspaces que lo declaran) y los que solo
 *   aparecen en alguna suscripción (`deducido`).
 * - Suscripciones: cada una con su `consumidor`, el workspace que la declara.
 *
 * Valida cada declaración otra vez, porque un `mrpack.pubsub.ts` puede exportar un objeto sin pasar por
 * {@link definirPubSub}. El orden de salida es alfabético, así que no depende del orden de entrada.
 *
 * @param declaraciones - Una por workspace.
 * @returns La topología fusionada.
 * @throws {Error} Si alguna declaración no es válida o si una misma suscripción la declaran dos workspaces.
 */
export function fusionar(declaraciones: IDeclaracionWorkspace[]): ITopologia {
    const declarados = new Map<string, Set<string>>();
    const referenciados = new Set<string>();
    const suscripciones = new Map<string, ISuscripcionTopologia>();

    for (const {workspace, declaracion} of declaraciones) {
        const valida = validarDeclaracion(declaracion, workspace);
        for (const topic of valida.topics ?? []) {
            const publicadores = declarados.get(topic) ?? new Set<string>();
            publicadores.add(workspace);
            declarados.set(topic, publicadores);
        }
        for (const suscripcion of valida.suscripciones ?? []) {
            const previa = suscripciones.get(suscripcion.nombre);
            if (previa !== undefined) {
                throw new Error(`La suscripción "${suscripcion.nombre}" está declarada por ${previa.consumidor} y por ${workspace}: cada suscripción tiene un único consumidor.`);
            }
            suscripciones.set(suscripcion.nombre, {...suscripcion, consumidor: workspace});
            referenciados.add(suscripcion.topic);
        }
    }

    const nombres = new Set<string>([...declarados.keys(), ...referenciados]);
    return {
        topics: [...nombres].sort(comparar).map((nombre) => ({
            nombre,
            declaradoPor: [...declarados.get(nombre) ?? []].sort(comparar),
            deducido: !declarados.has(nombre),
        })),
        suscripciones: [...suscripciones.values()].sort((a, b) => comparar(a.nombre, b.nombre)),
    };
}

/**
 * Endpoint al que el emulador entrega los mensajes de una suscripción push.
 *
 * Toma protocolo y puerto de `push.base`, cambia el host por `pushHost` y añade la ruta. El host hay que cambiarlo
 * porque el emulador corre en un docker y para él `localhost` es el propio contenedor. Cualquier ruta, parámetro o
 * fragmento que lleve `base` se ignora: la ruta va en `push.ruta`.
 *
 * @param push - Entrega declarada.
 * @param pushHost - Host por el que el emulador llega a la máquina (`host.docker.internal`).
 * @returns El endpoint; p. ej. base `http://localhost:17073` y ruta por defecto dan `http://host.docker.internal:17073/`.
 */
export function endpointPush(push: IPushDeclarado, pushHost: string): string {
    return `${new URL(push.base).protocol}//${pushHost}:${puertoPush(push)}${push.ruta ?? "/"}`;
}

/**
 * Puerto en el que escucha el servicio que recibe una suscripción push.
 *
 * `URL.port` es la cadena vacía cuando `push.base` escribe el puerto por defecto del protocolo (`http://localhost:80`),
 * así que ese caso se resuelve aquí: 443 para `https:` y 80 para el resto.
 *
 * @param push - Entrega declarada.
 * @returns El puerto, como cadena.
 */
export function puertoPush(push: IPushDeclarado): string {
    const base = new URL(push.base);
    return base.port !== "" ? base.port : (base.protocol === "https:" ? "443" : "80");
}

/**
 * Diferencias entre una suscripción declarada y la del emulador, separadas por lo que exige corregirlas.
 */
interface IDiferencias {
    recrear: string[];
    push: string[];
}

function analizar(declarada: ISuscripcionDeclarada, existente: ISuscripcionEmulador, {proyecto, pushHost}: IConfigComparacion): IDiferencias {
    const diferencias: IDiferencias = {recrear: [], push: []};

    const topicDeclarado = nombreCorto(declarada.topic, proyecto);
    const topicExistente = nombreCorto(existente.topic, proyecto);
    if (topicDeclarado !== topicExistente) {
        diferencias.recrear.push(`topic: ${topicExistente} -> ${topicDeclarado}`);
    }

    const filtroDeclarado = declarada.filtro ?? "";
    const filtroExistente = existente.filtro ?? "";
    if (filtroDeclarado !== filtroExistente) {
        diferencias.recrear.push(`filtro: ${JSON.stringify(filtroExistente)} -> ${JSON.stringify(filtroDeclarado)}`);
    }

    const ackDeclarado = declarada.ackDeadline ?? ACK_DEADLINE_DEFECTO;
    if (ackDeclarado !== existente.ackDeadline) {
        diferencias.recrear.push(`ackDeadline: ${existente.ackDeadline} -> ${ackDeclarado}`);
    }

    const endpointDeclarado = declarada.push !== undefined ? endpointPush(declarada.push, pushHost) : "";
    const endpointExistente = existente.pushEndpoint ?? "";
    if (endpointDeclarado !== endpointExistente) {
        diferencias.push.push(`push: ${endpointExistente === "" ? "pull" : endpointExistente} -> ${endpointDeclarado === "" ? "pull" : endpointDeclarado}`);
    }

    return diferencias;
}

/**
 * Compara una suscripción declarada con la que hay en el emulador, para saber qué hay que hacer con ella.
 *
 * Se recrea (el emulador no deja modificar estas propiedades) si difieren el topic, el filtro o el `ackDeadline`. Si
 * no, y solo difiere el endpoint push, basta con modificarlo. Se consideran iguales un filtro vacío y uno ausente, un
 * endpoint ausente y uno vacío, y un `ackDeadline` sin declarar y el 10 por defecto del emulador.
 *
 * @param declarada - Lo que dice la topología.
 * @param existente - Lo que hay en el emulador.
 * @param config - Proyecto y host de push del emulador.
 * @returns Qué hacer con la suscripción.
 */
export function compararSuscripcion(declarada: ISuscripcionDeclarada, existente: ISuscripcionEmulador, config: IConfigComparacion): TComparacionSuscripcion {
    const {recrear, push} = analizar(declarada, existente, config);
    if (recrear.length > 0) {
        return "recrear";
    }
    return push.length > 0 ? "push" : "igual";
}

/**
 * Describe en qué difiere una suscripción declarada de la del emulador, una línea por propiedad (`filtro: "a" -> "b"`).
 *
 * Es el detalle de lo que {@link compararSuscripcion} resume en una palabra.
 *
 * @param declarada - Lo que dice la topología.
 * @param existente - Lo que hay en el emulador.
 * @param config - Proyecto y host de push del emulador.
 * @returns Las diferencias, con las que obligan a recrearla primero; vacío si son iguales.
 */
export function describirDiferencias(declarada: ISuscripcionDeclarada, existente: ISuscripcionEmulador, config: IConfigComparacion): string[] {
    const {recrear, push} = analizar(declarada, existente, config);
    return [...recrear, ...push];
}
