/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: a9f2036bafa860758b5e2939bbb512a9
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IConfirmacionHeartbeat, IHeartbeat} from "./interface";
import {METODO_HEARTBEAT, METODO_HEARTBEAT_CONFIRMADO} from "./interface";

/**
 * Respuesta de `get()` ya leída: `ok` es lo que dijo el servidor (`ok: false` es «no sé atender ese método», que es lo que
 * contesta un receptor anterior a {@link METODO_HEARTBEAT_CONFIRMADO}). Un fallo de red, un timeout o un circuito abierto no
 * llegan aquí: `get()` rechaza.
 */
export type TRespuestaPool = {ok: true; data: unknown}|{ok: false; motivo: string};

/**
 * Lo que el emisor usa de `WSPool` (`@mr/core-network/client/websocket`).
 *
 * @property head - Envía sin esperar respuesta.
 * @property get - Envía y espera la primera respuesta; rechaza si no hay conexión, si se agota el tiempo o si el circuito está abierto.
 *   `config.alConectar` se llama una vez, en cuanto el pool tiene una conexión por la que enviar y antes de esperar la respuesta: sirve
 *   para distinguir «no llegó a haber conexión» de «había conexión y no contestaron». Ojo: «tiene conexión» puede ser un socket ya
 *   abierto que en realidad está muerto, no un handshake que acaba de completarse.
 * @property vaciar - Espera a que lo enviado salga del proceso, con un tiempo máximo.
 * @property destroy - Cierra las conexiones y no vuelve a abrirlas.
 */
export interface IPoolHeartbeat {
    head<T>(method: string, params?: T): Promise<void>;
    get<T>(method: string, params?: T, config?: IConfigGetPool): Promise<TRespuestaPool>;
    vaciar(config?: {timeoutMs?: number}): Promise<void>;
    destroy(): void;
}

/**
 * Opciones de {@link IPoolHeartbeat.get}.
 *
 * @property alConectar - Se llama cuando el pool ya tiene conexión, antes de esperar la respuesta.
 */
export interface IConfigGetPool {
    alConectar?: () => void;
}

/**
 * Un temporizador cancelable.
 *
 * @property promesa - Resuelve (sin valor) al cumplirse el tiempo.
 * @property cancelar - Lo desarma; hay que llamarlo siempre.
 */
export interface ITemporizador {
    promesa: Promise<void>;
    cancelar(): void;
}

/**
 * El reloj de la despedida, inyectado para poder probarla sin esperas.
 *
 * @property ahora - Epoch ms.
 * @property temporizador - Crea un temporizador de `ms` milisegundos.
 */
export interface IRelojDespedida {
    ahora(): number;
    temporizador(ms: number): ITemporizador;
}

/**
 * Cómo acabó la despedida.
 *
 * - `confirmado`    — el receptor contestó `confirmado`.
 * - `reserva`       — el receptor no conoce el método de confirmación (receptor anterior): el `parado` salió por
 *   {@link METODO_HEARTBEAT} sin acuse, como siempre.
 * - `sin-confirmar` — ningún intento se confirmó dentro del presupuesto; `motivo` dice por qué.
 */
export type TResultadoDespedida = "confirmado"|"reserva"|"sin-confirmar";

/**
 * Lo que devuelve {@link despedirConfirmado}.
 *
 * @property resultado - Cómo acabó.
 * @property intentos - Intentos hechos (1 es el pool del emisor, que tras el `Shutdown` de un receptor suele ser ya una conexión
 *   nueva y no una «caliente»; 2, un pool de un solo uso por el mismo Service).
 * @property ms - Tiempo gastado desde que empezó, según el reloj.
 * @property motivo - Solo en `sin-confirmar`: el motivo de cada intento, en orden (`intento 1: …; intento 2: …`). Un timeout dice si
 *   el pool llegó a tener conexión (y a los cuántos ms del intento) o no; «había conexión» no garantiza que el socket estuviera vivo.
 *   `sin-confirmar` no significa «perdido»: un intento abandonado puede llegar igualmente si su handshake abre antes del `exit`, y
 *   el receptor lo aplica.
 */
export interface IInformeDespedida {
    resultado: TResultadoDespedida;
    intentos: number;
    ms: number;
    motivo?: string;
}

/**
 * Configuración de {@link despedirConfirmado}.
 *
 * @property pool - El pool del emisor (intento 1). Puede tener ya una conexión abierta o, si el receptor mandó `Shutdown`, estar
 *   reconectando: en ese caso el intento 1 paga un handshake nuevo. Se destruye al terminar.
 * @property abrirNuevo - Fábrica de un pool de un solo uso, con conexión nueva (otra clave del singleton, sin reconexión) por el
 *   mismo Service: cae en otra réplica solo si hay otra viva que acepte la conexión. Se destruye cada vez que se acaba con él.
 * @property mensaje - El `parado`, construido una vez: es el mismo en todos los intentos.
 * @property reloj - Reloj inyectado.
 * @property presupuestoMs - Tiempo total máximo. Por defecto {@link PRESUPUESTO_DESPEDIDA_MS}.
 * @property intentoMs - Tiempo máximo del intento 1, el del pool del emisor. Por defecto {@link INTENTO_DESPEDIDA_MS}. El reintento
 *   por conexión nueva no tiene este tope: usa lo que quede del presupuesto menos {@link MARGEN_RESERVA_MS}.
 * @property vaciarMs - Tiempo máximo de `vaciar()` tras el envío de reserva. Por defecto 500.
 */
export interface IConfigDespedida {
    pool: IPoolHeartbeat;
    abrirNuevo: () => IPoolHeartbeat;
    mensaje: IHeartbeat;
    reloj: IRelojDespedida;
    presupuestoMs?: number;
    intentoMs?: number;
    vaciarMs?: number;
}

/**
 * Tiempo total de la despedida desde que `despedir()` arranca. Queda por debajo del 1 s de `antesDeSalir`, de `despedirAcotado`
 * del primario y de Next.
 */
export const PRESUPUESTO_DESPEDIDA_MS = 900;

/**
 * Tiempo total de la despedida de una carga finita (cronjob o job) que acaba por sí sola, fuera del camino de una señal: no hay
 * `antesDeSalir` de 1 s que respetar y sí un `parado` que, en una ejecución corta, puede llegar antes que los metadatos de GKE
 * (el contexto no se resuelve sin ellos), así que la despedida los espera dentro de este presupuesto. Lo último que se gasta
 * es {@link PRESUPUESTO_DESPEDIDA_MS}, para el envío.
 */
export const PRESUPUESTO_DESPEDIDA_FINITA_MS = 3000;

/**
 * Tiempo máximo del intento 1 (pool del emisor). Pensado para una conexión ya abierta, que contesta en pocos ms o no contesta; pero
 * tras el `Shutdown` de un receptor esa conexión ya no existe y este intento es un handshake nuevo, que en 300 ms no llega a
 * completarse si el receptor que queda está saturado por las reconexiones (medido el 2026-11-18).
 */
export const INTENTO_DESPEDIDA_MS = 300;

/**
 * Lo que se reserva del presupuesto, en el reintento, para el `head()` + `vaciar()` de reserva por si el receptor contesta
 * `ok: false` (receptor anterior). 100 ms: el `head()` va por una conexión ya abierta (la acaba de abrir el `get()`) y `vaciar()`
 * solo espera a que salga lo enviado; menos dejaría la reserva sin margen real y más le quitaría al handshake de una conexión nueva
 * (DNS + TCP + TLS + upgrade, ~300-600 ms tras Cloudflare) el tiempo que necesita para confirmar, que es lo que importa.
 */
export const MARGEN_RESERVA_MS = 100;

/** Por debajo de este margen no se empieza el reintento: no daría tiempo ni a abrir la conexión. */
const MARGEN_MIN_INTENTO_MS = 30;

type TIntento = {tipo: "confirmado"}|{tipo: "rechazado"}|{tipo: "reintentar"|"fallo"; motivo: string};

/** El motivo de un timeout: con conexión (y a los cuántos ms) o sin ella. */
function motivoSinRespuesta(topeMs: number, conectadoEnMs: number|null): string {
    return conectadoEnMs === null ? `sin respuesta en ${topeMs} ms (no llegó a haber conexión)` : `sin respuesta en ${topeMs} ms (había conexión desde los ${conectadoEnMs} ms)`;
}

function describir(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function esConfirmacion(data: unknown, resultado: IConfirmacionHeartbeat["resultado"]): boolean {
    return typeof data === "object" && data !== null && (data as Partial<IConfirmacionHeartbeat>).resultado === resultado;
}

/**
 * Un intento: `get(METODO_HEARTBEAT_CONFIRMADO)` con tope de tiempo. Nunca rechaza.
 */
async function intentar(pool: IPoolHeartbeat, mensaje: IHeartbeat, reloj: IRelojDespedida, topeMs: number): Promise<TIntento> {
    const temporizador = reloj.temporizador(topeMs);
    const inicio = reloj.ahora();
    let conectadoEnMs: number|null = null;
    try {
        const respuesta = pool.get(METODO_HEARTBEAT_CONFIRMADO, mensaje, {alConectar: () => { conectadoEnMs ??= reloj.ahora() - inicio; }}).then((r): TIntento => {
            if (!r.ok) {
                return {tipo: "rechazado"};
            }
            if (esConfirmacion(r.data, "confirmado")) {
                return {tipo: "confirmado"};
            }
            if (esConfirmacion(r.data, "reintentar")) {
                return {tipo: "reintentar", motivo: "el receptor se está apagando"};
            }

            return {tipo: "fallo", motivo: "respuesta de confirmación desconocida"};
        }, (err: unknown): TIntento => ({tipo: "fallo", motivo: describir(err)}));
        const vencido = temporizador.promesa.then((): TIntento => ({tipo: "fallo", motivo: motivoSinRespuesta(topeMs, conectadoEnMs)}));

        return await Promise.race([respuesta, vencido]);
    } catch (err) {
        // `get()` lanzando de forma síncrona (un pool falso, un circuito abierto).
        return {tipo: "fallo", motivo: describir(err)};
    } finally {
        temporizador.cancelar();
    }
}

/**
 * La despedida con acuse: manda el `parado` con {@link METODO_HEARTBEAT_CONFIRMADO} y espera la confirmación del receptor.
 *
 * 1. **Intento 1** por el pool del emisor, hasta `intentoMs` (300 ms). Es una conexión ya abierta solo si nada la ha cerrado: tras el
 *    `Shutdown` de un receptor, lo normal es que el pool esté reconectando y este intento sea ya un handshake nuevo.
 * 2. Si el receptor contesta `ok: false` (no conoce el método: receptor anterior), manda el mismo `parado` por
 *    {@link METODO_HEARTBEAT} con `head()` y `vaciar()` y acaba, **sin reintento**.
 * 3. Si no hay respuesta, hay un fallo de conexión o el receptor dice `reintentar`, vuelve a mandar **el mismo** `parado` por un
 *    pool **nuevo** de un solo uso (otra conexión por el mismo Service, que cae en otra réplica solo si hay otra viva; si el único
 *    receptor que queda está atascado, se atasca igual): **un único reintento** con todo el presupuesto
 *    que quede menos {@link MARGEN_RESERVA_MS}. No se parte en varios intentos cortos: cada uno pagaría el handshake entero y lo
 *    abandonaría a medias. Repetirlo es inocuo: el receptor ignora un `seq` ya visto.
 * 4. Siempre `destroy()` de todos los pools. Nunca rechaza.
 *
 * Lo que esto **no** arregla por sí mismo: el fallo medido en producción (2026-11-18) es la saturación del receptor que queda cuando
 * otro muere (sus clientes reconectaban a la vez, 340-575 conexiones en 2-3 s, y se atasca 3-4 s); ninguna variante de despedida
 * dentro de 1 s lo resuelve. Eso lo ataca el servidor WebSocket de `@mr/core-network`, que desde entonces reparte el `Shutdown` del
 * apagado entre sus clientes (a ~40/s, hasta 10 s, con 50 clientes o más): el receptor que muere ya no devuelve a todos a la vez
 * contra el que queda, así que el intento 1 o el reintento encuentran un superviviente tranquilo. Aquí no cambia nada: este emisor
 * no depende de esa parte (ni usa `refillJitterMs` del pool), de modo que versiones mezcladas de los dos paquetes compilan y
 * funcionan. Y `sin-confirmar` no es «perdido»: un intento abandonado puede llegar igualmente si su handshake abre antes del `exit`.
 */
export async function despedirConfirmado({pool, abrirNuevo, mensaje, reloj, presupuestoMs = PRESUPUESTO_DESPEDIDA_MS, intentoMs = INTENTO_DESPEDIDA_MS, vaciarMs = 500}: IConfigDespedida): Promise<IInformeDespedida> {
    const inicio = reloj.ahora();
    const restante = (): number => presupuestoMs - (reloj.ahora() - inicio);
    const pools: IPoolHeartbeat[] = [pool];
    let intentos = 0;
    const motivos: string[] = [];
    const informe = (resultado: TResultadoDespedida): IInformeDespedida => {
        const base: IInformeDespedida = {resultado, intentos, ms: reloj.ahora() - inicio};

        return resultado === "sin-confirmar" ? {...base, motivo: motivos.length > 0 ? motivos.join("; ") : "sin presupuesto"} : base;
    };

    /** El respaldo para un receptor anterior: el mismo `parado` por `head()`, sin acuse. */
    const reserva = async (actual: IPoolHeartbeat): Promise<IInformeDespedida> => {
        try {
            await actual.head(METODO_HEARTBEAT, mensaje);
            const margen = Math.min(vaciarMs, restante());
            if (margen > 0) {
                await actual.vaciar({timeoutMs: margen});
            }

            return informe("reserva");
        } catch (err) {
            motivos.push(`el receptor no confirma y el envío de reserva falló: ${describir(err)}`);

            return informe("sin-confirmar");
        }
    };

    try {
        while (intentos < 2) {
            // Intento 1: el tope corto. Reintento: todo lo que quede salvo la reserva.
            const topeMs = intentos === 0 ? Math.min(intentoMs, restante()) : restante() - MARGEN_RESERVA_MS;
            if (intentos > 0 && topeMs < MARGEN_MIN_INTENTO_MS) {
                motivos.push("sin presupuesto para el reintento");
                break;
            }
            let actual = pool;
            if (intentos > 0) {
                try {
                    actual = abrirNuevo();
                } catch (err) {
                    motivos.push(`no se pudo abrir una conexión nueva: ${describir(err)}`);
                    break;
                }
                pools.push(actual);
            }
            intentos++;

            const intento = await intentar(actual, mensaje, reloj, Math.max(1, topeMs));
            if (intento.tipo === "confirmado") {
                return informe("confirmado");
            }
            if (intento.tipo === "rechazado") {
                return await reserva(actual);
            }
            motivos.push(`intento ${intentos}: ${intento.motivo}`);
            if (actual !== pool) {
                actual.destroy();
                pools.pop();
            }
        }

        return informe("sin-confirmar");
    } catch (err) {
        motivos.push(describir(err));

        return informe("sin-confirmar");
    } finally {
        for (const abierto of pools) {
            try {
                abierto.destroy();
            } catch {
                // destroy() no debería lanzar; la despedida nunca rechaza.
            }
        }
    }
}
