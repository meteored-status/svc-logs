/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: 6836b0aad5be74f5c58d7e91211c23db
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {type IConfigGetPool, type IPoolHeartbeat, type IRelojDespedida, type TRespuestaPool, despedirConfirmado} from "../heartbeat/despedida";
import {type IHeartbeat, METODO_HEARTBEAT, METODO_HEARTBEAT_CONFIRMADO} from "../heartbeat/interface";

/**
 * El algoritmo de la despedida con pools, reloj y fábrica falsos: confirmación al primer intento, receptor anterior (`ok: false`),
 * silencio, caída, `reintentar`, presupuesto y `destroy`.
 */

const MENSAJE = {seq: 7, estado: "parado", tseq: 3} as unknown as IHeartbeat;

const CONFIRMADO: TRespuestaPool = {ok: true, data: {v: 1, resultado: "confirmado"}};
const REINTENTAR: TRespuestaPool = {ok: true, data: {v: 1, resultado: "reintentar"}};
const VIEJO: TRespuestaPool = {ok: false, motivo: "No handler for method heartbeat-confirmado"};

/**
 * Una respuesta programada: la propia respuesta, un error al pedir, un `get()` que nunca contesta (`silencio`: ni llega a haber
 * conexión), uno que conecta a los `conectaEnMs` del reloj y luego no contesta, o uno que tarda `demoraMs` del reloj.
 */
type TGuion = TRespuestaPool|Error|"silencio"|{conectaEnMs: number}|{demoraMs: number; respuesta: TRespuestaPool};

/**
 * Un reloj que adelanta el tiempo hasta el siguiente temporizador pendiente: ni esperas reales ni carreras. Los temporizadores
 * vencen por orden de instante, así que uno de 400 ms (`esperar`) gana a uno de 500 ms aunque se haya creado después.
 */
class RelojFalso implements IRelojDespedida {
    public t = 0;
    public readonly pedidos: number[] = [];

    private readonly pendientes: {vence: number; resolver: () => void}[] = [];
    private programado = false;

    public ahora(): number {
        return this.t;
    }

    /** Un temporizador que no consta en `pedidos`: la demora de un pool falso, no un tope de la despedida. */
    public esperar(ms: number): Promise<void> {
        return this.armar(ms).promesa;
    }

    public temporizador(ms: number): {promesa: Promise<void>; cancelar(): void} {
        this.pedidos.push(ms);

        return this.armar(ms);
    }

    private armar(ms: number): {promesa: Promise<void>; cancelar(): void} {
        let entrada!: {vence: number; resolver: () => void};
        const promesa = new Promise<void>((resolve) => {
            entrada = {vence: this.t + ms, resolver: resolve};
        });
        this.pendientes.push(entrada);
        this.programar();

        return {promesa, cancelar: () => {
            const i = this.pendientes.indexOf(entrada);
            if (i >= 0) {
                this.pendientes.splice(i, 1);
            }
        }};
    }

    private programar(): void {
        if (this.programado) {
            return;
        }
        this.programado = true;
        setImmediate(() => {
            this.programado = false;
            const siguiente = this.pendientes.sort((a, b) => a.vence - b.vence).shift();
            if (siguiente) {
                this.t = Math.max(this.t, siguiente.vence);
                siguiente.resolver();
            }
            if (this.pendientes.length > 0) {
                this.programar();
            }
        });
    }
}

class PoolFalso implements IPoolHeartbeat {
    public readonly llamadas: {metodo: string; params: unknown}[] = [];
    public readonly orden: string[] = [];
    public destruido = 0;
    public falloHead = false;
    public reloj: RelojFalso|undefined;

    private readonly guion: TGuion[];

    public constructor(...guion: TGuion[]) {
        this.guion = guion;
    }

    public async head<T>(metodo: string, params?: T): Promise<void> {
        this.orden.push("head");
        this.llamadas.push({metodo, params});
        if (this.falloHead) {
            throw new Error("sin conexión");
        }
    }

    public async get<T>(metodo: string, params?: T, config?: IConfigGetPool): Promise<TRespuestaPool> {
        this.orden.push("get");
        this.llamadas.push({metodo, params});
        const paso = this.guion.shift() ?? CONFIRMADO;
        if (paso === "silencio") {
            return new Promise<TRespuestaPool>(() => undefined);
        }
        if (paso instanceof Error) {
            throw paso;
        }
        if ("conectaEnMs" in paso) {
            await this.reloj?.esperar(paso.conectaEnMs);
            config?.alConectar?.();

            return new Promise<TRespuestaPool>(() => undefined);
        }
        if ("demoraMs" in paso) {
            await this.reloj?.esperar(paso.demoraMs);

            return paso.respuesta;
        }

        return paso;
    }

    public async vaciar(): Promise<void> {
        this.orden.push("vaciar");
    }

    public destroy(): void {
        this.destruido++;
    }
}

function montar(principal: PoolFalso, ...nuevos: PoolFalso[]) {
    const reloj = new RelojFalso();
    principal.reloj = reloj;
    for (const nuevo of nuevos) {
        nuevo.reloj = reloj;
    }
    const abiertos: PoolFalso[] = [];
    const abrirNuevo = (): IPoolHeartbeat => {
        const siguiente = nuevos.shift() ?? new PoolFalso();
        abiertos.push(siguiente);

        return siguiente;
    };

    return {reloj, abiertos, despedir: async (extra: {presupuestoMs?: number} = {}) => despedirConfirmado({pool: principal, abrirNuevo, mensaje: MENSAJE, reloj, ...extra})};
}

describe("despedirConfirmado()", () => {
    it("confirma al primer intento: un solo get, sin head y sin pool nuevo", async () => {
        const pool = new PoolFalso(CONFIRMADO);
        const {abiertos, despedir} = montar(pool);
        const informe = await despedir();
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 1);
        assert.deepEqual(pool.orden, ["get"]);
        assert.equal(pool.llamadas[0]?.metodo, METODO_HEARTBEAT_CONFIRMADO);
        assert.equal(abiertos.length, 0);
    });

    it("ok:false (receptor anterior): head de reserva en el mismo pool, sin reintento ni pool nuevo", async () => {
        const pool = new PoolFalso(VIEJO);
        const {abiertos, despedir} = montar(pool);
        const informe = await despedir();
        assert.equal(informe.resultado, "reserva");
        assert.equal(informe.intentos, 1);
        assert.deepEqual(pool.orden, ["get", "head", "vaciar"]);
        assert.equal(pool.llamadas[1]?.metodo, METODO_HEARTBEAT);
        assert.equal(abiertos.length, 0);
    });

    it("silencio: tras el tope del intento reintenta por un pool nuevo, que confirma", async () => {
        const pool = new PoolFalso("silencio");
        const nuevo = new PoolFalso(CONFIRMADO);
        const {reloj, abiertos, despedir} = montar(pool, nuevo);
        const informe = await despedir();
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 2);
        assert.deepEqual(abiertos, [nuevo]);
        assert.deepEqual(nuevo.orden, ["get"]);
        assert.equal(reloj.pedidos[0], 300, "el primer intento tiene un tope de 300 ms");
        assert.equal(reloj.pedidos[1], 500, "el reintento tiene lo que queda (600) menos 100 de reserva");
        assert.equal(informe.ms, 300);
    });

    it("un pool nuevo que tarda ~400 ms en confirmar (handshake lento) se confirma: el reintento no tiene el tope de 300", async () => {
        const pool = new PoolFalso("silencio");
        const nuevo = new PoolFalso({demoraMs: 400, respuesta: CONFIRMADO});
        const {reloj, abiertos, despedir} = montar(pool, nuevo);
        nuevo.reloj = reloj;
        const informe = await despedir();
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 2);
        assert.deepEqual(abiertos, [nuevo]);
        assert.equal(informe.ms, 700);
    });

    it("una caída o un get() que lanza (circuito abierto): pool nuevo", async () => {
        const pool = new PoolFalso(new Error("Circuit breaker open"));
        const nuevo = new PoolFalso(CONFIRMADO);
        const {despedir} = montar(pool, nuevo);
        const informe = await despedir();
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 2);
        assert.deepEqual(nuevo.orden, ["get"]);
    });

    it("reintentar: pool nuevo", async () => {
        const pool = new PoolFalso(REINTENTAR);
        const nuevo = new PoolFalso(CONFIRMADO);
        const {despedir} = montar(pool, nuevo);
        const informe = await despedir();
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 2);
    });

    it("una respuesta que no es una confirmación conocida cuenta como fallo del intento", async () => {
        const pool = new PoolFalso({ok: true, data: {v: 1, resultado: "otra-cosa"}});
        const nuevo = new PoolFalso(CONFIRMADO);
        const {despedir} = montar(pool, nuevo);
        assert.equal((await despedir()).intentos, 2);
    });

    it("receptor anterior en los dos intentos: head de reserva en el pool nuevo, sin tercer intento", async () => {
        const pool = new PoolFalso("silencio");
        const nuevo = new PoolFalso(VIEJO);
        const {abiertos, despedir} = montar(pool, nuevo);
        const informe = await despedir();
        assert.equal(informe.resultado, "reserva");
        assert.equal(informe.intentos, 2);
        assert.deepEqual(nuevo.orden, ["get", "head", "vaciar"]);
        assert.equal(abiertos.length, 1);
        assert.equal(pool.orden.includes("head"), false, "el head de reserva va por el pool que contestó ok:false");
    });

    it("si el head de reserva falla, no se confirma y se dice por qué; sin más reintentos", async () => {
        const pool = new PoolFalso(VIEJO);
        pool.falloHead = true;
        const {abiertos, despedir} = montar(pool);
        const informe = await despedir();
        assert.equal(informe.resultado, "sin-confirmar");
        assert.match(informe.motivo ?? "", /reserva/);
        assert.equal(abiertos.length, 0);
    });

    it("presupuesto agotado: un solo reintento, dentro del límite, y nunca rechaza", async () => {
        const pool = new PoolFalso("silencio");
        const {reloj, abiertos, despedir} = montar(pool, new PoolFalso("silencio"), new PoolFalso("silencio"));
        const informe = await despedir();
        assert.equal(informe.resultado, "sin-confirmar");
        assert.ok(informe.ms <= 900, `gastó ${informe.ms} ms`);
        assert.equal(informe.intentos, 2, "300 ms en caliente y un único reintento con el resto");
        assert.match(informe.motivo ?? "", /sin respuesta/);
        assert.equal(abiertos.length, 1);
        assert.deepEqual(reloj.pedidos, [300, 500]);
    });

    it("motivo sin conexión: dice que no llegó a haber conexión, en cada intento", async () => {
        const pool = new PoolFalso("silencio");
        const {despedir} = montar(pool, new PoolFalso("silencio"));
        const informe = await despedir();
        assert.equal(informe.motivo, "intento 1: sin respuesta en 300 ms (no llegó a haber conexión); intento 2: sin respuesta en 500 ms (no llegó a haber conexión)");
    });

    it("motivo con conexión: dice desde cuántos ms del intento había conexión, sin decir que «conectó»", async () => {
        const pool = new PoolFalso({conectaEnMs: 0});
        const {despedir} = montar(pool, new PoolFalso({conectaEnMs: 120}));
        const informe = await despedir();
        assert.equal(informe.resultado, "sin-confirmar");
        assert.equal(informe.motivo, "intento 1: sin respuesta en 300 ms (había conexión desde los 0 ms); intento 2: sin respuesta en 500 ms (había conexión desde los 120 ms)");
    });

    it("el motivo recoge los dos intentos aunque difieran: sin conexión en el 1 y con conexión en el 2", async () => {
        const pool = new PoolFalso("silencio");
        const {despedir} = montar(pool, new PoolFalso({conectaEnMs: 250}));
        const informe = await despedir();
        assert.equal(informe.motivo, "intento 1: sin respuesta en 300 ms (no llegó a haber conexión); intento 2: sin respuesta en 500 ms (había conexión desde los 250 ms)");
    });

    it("el motivo de un fallo que no es timeout también va por intento", async () => {
        const pool = new PoolFalso(new Error("Circuit breaker open"));
        const {despedir} = montar(pool, new PoolFalso(REINTENTAR));
        const informe = await despedir();
        assert.equal(informe.motivo, "intento 1: Circuit breaker open; intento 2: el receptor se está apagando");
    });

    it("el tope del reintento nunca pasa de lo que queda del presupuesto menos la reserva", async () => {
        const pool = new PoolFalso("silencio");
        const {reloj, despedir} = montar(pool, new PoolFalso("silencio"));
        const informe = await despedir({presupuestoMs: 700});
        assert.deepEqual(reloj.pedidos, [300, 300]);
        assert.equal(informe.ms, 600);
        assert.equal(informe.resultado, "sin-confirmar");
    });

    it("si tras el intento 1 no queda ni para abrir una conexión más la reserva, no se reintenta", async () => {
        const pool = new PoolFalso("silencio");
        const {reloj, abiertos, despedir} = montar(pool, new PoolFalso("silencio"));
        const informe = await despedir({presupuestoMs: 400});
        assert.deepEqual(reloj.pedidos, [300]);
        assert.equal(informe.intentos, 1);
        assert.equal(abiertos.length, 0);
        assert.equal(informe.resultado, "sin-confirmar");
    });

    it("con el presupuesto a cero el primer intento se hace igualmente, con tope mínimo, y no se abre nada más", async () => {
        const pool = new PoolFalso("silencio");
        const {abiertos, despedir} = montar(pool);
        const informe = await despedir({presupuestoMs: 0});
        assert.equal(informe.intentos, 1);
        assert.equal(abiertos.length, 0);
        assert.equal(informe.resultado, "sin-confirmar");
    });

    it("destroy() de todos los pools, una vez cada uno, en todos los caminos", async () => {
        for (const guion of [[CONFIRMADO], [VIEJO], ["silencio", REINTENTAR]] as TGuion[][]) {
            const pool = new PoolFalso(...guion);
            const nuevos = [new PoolFalso(CONFIRMADO), new PoolFalso(CONFIRMADO)];
            const {abiertos, despedir} = montar(pool, ...nuevos);
            await despedir();
            assert.equal(pool.destruido, 1, `principal con ${JSON.stringify(guion)}`);
            for (const abierto of abiertos) {
                assert.equal(abierto.destruido, 1, "cada pool nuevo se destruye una vez");
            }
        }
    });

    it("destroy() también cuando abrir el pool nuevo lanza; y nunca rechaza", async () => {
        const pool = new PoolFalso(REINTENTAR);
        const reloj = new RelojFalso();
        const informe = await despedirConfirmado({pool, abrirNuevo: () => { throw new Error("sin sockets"); }, mensaje: MENSAJE, reloj});
        assert.equal(informe.resultado, "sin-confirmar");
        assert.match(informe.motivo ?? "", /sin sockets/);
        assert.equal(pool.destruido, 1);
    });

    it("el mismo mensaje (mismo seq, misma referencia) en todos los intentos", async () => {
        const pool = new PoolFalso("silencio");
        const dos = new PoolFalso(CONFIRMADO);
        const {despedir} = montar(pool, dos);
        const informe = await despedir();
        assert.equal(informe.intentos, 2);
        const enviados = [pool, dos].flatMap((p) => p.llamadas.map((l) => l.params));
        assert.equal(enviados.length, 2);
        assert.ok(enviados.every((m) => m === MENSAJE));
        assert.equal((enviados[0] as IHeartbeat).seq, 7);
    });
});
