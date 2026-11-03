/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 95ebac17c7c3a2304f5da6529c645cc2
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

import {describe, it, mock} from "node:test";
import {setTimeout as sleep} from "node:timers/promises";
import assert from "node:assert/strict";

import {ClientOfflineError, type RedisClientType} from "redis";

import {isOlderRedis, RedisCluster, redisVersion, validateSingleNode, warnIfOldRedis, type IClusterOptions, type IRedisNode} from "../../../modules/database/redis/cluster";
import {FakeResp} from "./fake-resp";

const OPTIONS: IClusterOptions = {maxReconnectDelayMs: 100, logThrottleMs: 0};

function node(server: FakeResp): IRedisNode {
    return {host: "127.0.0.1", port: String(server.port)};
}

async function waitUntil(condition: () => boolean, message: string, maxMs = 3_000): Promise<void> {
    const limit = Date.now() + maxMs;
    while (!condition()) {
        if (Date.now() > limit) {
            assert.fail(`Se agotó el tiempo esperando: ${message}`);
        }
        await sleep(10);
    }
}

/**
 * Crea el clúster, ejecuta la prueba y lo libera siempre (si no, sus sockets mantendrían vivo el proceso de pruebas).
 */
async function withCluster(primaries: IRedisNode[], read: IRedisNode | undefined, options: IClusterOptions, body: (cluster: RedisCluster) => Promise<void>): Promise<void> {
    const cluster = new RedisCluster(primaries, read, options);
    try {
        await body(cluster);
    } finally {
        await cluster[Symbol.asyncDispose]();
    }
}

describe("validateSingleNode", () => {
    it("acepta un índice de la lista", () => {
        assert.doesNotThrow(() => validateSingleNode(0, 1));
        assert.doesNotThrow(() => validateSingleNode(2, 3));
    });

    it("rechaza con RangeError lo que no es un índice de la lista", () => {
        for (const [index, total] of [[1, 1], [3, 3], [-1, 3], [0.5, 3], [NaN, 3], [Infinity, 3], [0, 0]]) {
            assert.throws(() => validateSingleNode(index, total), RangeError, `${index}/${total}`);
        }
    });
});

describe("isOlderRedis", () => {
    it("es verdadero por debajo de 6.3.0", () => {
        for (const version of ["5.0.0", "5.9.1", "6.0.0", "6.1.0", "6.2.1", "6.2.99", "5.10.0-beta.1"]) {
            assert.equal(isOlderRedis(version), true, version);
        }
    });

    it("es falso desde 6.3.0, y para lo que no se entiende", () => {
        for (const version of ["6.3.0", "6.3.1", "6.4.0", "7.0.0", "10.0.0", "6.3.0-rc.1", "", "latest", "x.y.z"]) {
            assert.equal(isOlderRedis(version), false, version);
        }
    });
});

describe("RedisCluster.reconnectDelay", () => {
    it("crece de forma exponencial desde 100 ms", () => {
        assert.equal(RedisCluster.reconnectDelay(0, {random: 0}), 100);
        assert.equal(RedisCluster.reconnectDelay(1, {random: 0}), 200);
        assert.equal(RedisCluster.reconnectDelay(5, {random: 0}), 3200);
    });

    it("llega al tope por defecto (5 s) y no pasa de ahí, por muchos intentos que haya", () => {
        assert.equal(RedisCluster.reconnectDelay(9, {random: 0}), RedisCluster.MAX_RECONNECT_DELAY_MS);
        for (const attempts of [10, 20, 100, 1_000_000, Number.MAX_SAFE_INTEGER]) {
            assert.equal(RedisCluster.reconnectDelay(attempts, {random: 0}), RedisCluster.MAX_RECONNECT_DELAY_MS);
        }
    });

    it("respeta el tope que se le pida", () => {
        assert.equal(RedisCluster.reconnectDelay(0, {random: 0, maxMs: 5_000}), 100);
        assert.equal(RedisCluster.reconnectDelay(6, {random: 0, maxMs: 5_000}), 5_000);
        assert.equal(RedisCluster.reconnectDelay(1_000, {random: 0, maxMs: 5_000}), 5_000);
    });

    it("nunca devuelve un error ni un valor no finito (no se rinde nunca)", () => {
        for (let attempts = -2; attempts < 200; attempts++) {
            const delay = RedisCluster.reconnectDelay(attempts, {random: 0.999});
            assert.equal(typeof delay, "number", String(attempts));
            assert.ok(Number.isFinite(delay) && delay >= 100 && delay < RedisCluster.MAX_RECONNECT_DELAY_MS + 250, String(attempts));
        }
    });

    it("aunque el tope sea infinito, la espera sigue siendo finita (el exponente está acotado)", () => {
        for (const attempts of [20, 1_000, Number.MAX_SAFE_INTEGER]) {
            assert.ok(Number.isFinite(RedisCluster.reconnectDelay(attempts, {random: 0, maxMs: Infinity})), String(attempts));
        }
    });

    it("un número de intentos negativo se trata como el primero", () => {
        assert.equal(RedisCluster.reconnectDelay(-2, {random: 0}), 100);
    });

    it("el azar suma hasta 250 ms", () => {
        assert.equal(RedisCluster.reconnectDelay(0, {random: 0.5}), 225);
        assert.ok(RedisCluster.reconnectDelay(0, {random: 0.9999}) < 350);
    });

    it("sin opciones usa Math.random() y el tope por defecto", () => {
        for (let i = 0; i < 50; i++) {
            const delay = RedisCluster.reconnectDelay(1_000);
            assert.ok(delay >= RedisCluster.MAX_RECONNECT_DELAY_MS && delay < RedisCluster.MAX_RECONNECT_DELAY_MS + 250);
        }
    });
});

describe("versión de redis", () => {
    it("se puede leer la versión instalada (require de redis/package.json con Yarn PnP)", () => {
        const version = redisVersion();
        assert.match(version ?? "", /^\d+\.\d+\.\d+/);
        assert.equal(isOlderRedis(version as string), false, "las pruebas corren con redis 6.3.0 o posterior");
    });

    it("avisa (un warning) solo si la versión es anterior a 6.3.0", () => {
        const warn = mock.method(console, "warn", () => undefined);
        try {
            assert.equal(warnIfOldRedis("6.3.0"), false);
            assert.equal(warnIfOldRedis(null), false);
            assert.equal(warn.mock.callCount(), 0);
            assert.equal(warnIfOldRedis("6.2.1"), true);
            assert.equal(warn.mock.callCount(), 1);
            assert.match(String(warn.mock.calls[0].arguments.join(" ")), /6\.2\.1/);
        } finally {
            warn.mock.restore();
        }
    });
});

describe("RedisCluster", () => {
    it("rechaza al crearlo un singleNode fuera de rango, sin abrir ninguna conexión", async () => {
        const server = await FakeResp.start();
        try {
            assert.throws(() => new RedisCluster([node(server)], undefined, {singleNode: 1}), RangeError);
            await sleep(50);
            assert.equal(server.connections, 0);
        } finally {
            await server.stop();
        }
    });

    it("primaries da un cliente por primario en orden, single el elegido y read el primero si no hay read", async () => {
        const a = await FakeResp.start();
        const b = await FakeResp.start();
        try {
            await withCluster([node(a), node(b)], undefined, {...OPTIONS, singleNode: 1}, async cluster => {
                const [clientA, clientB] = await Promise.all(cluster.primaries);
                assert.notEqual(clientA, clientB);
                assert.equal(await cluster.single, clientB);
                assert.equal(await cluster.read, clientA);
            });
        } finally {
            await a.stop();
            await b.stop();
        }
    });

    it("la primera operación espera a la conexión inicial: no falla por arrancar un instante antes de conectar", async () => {
        const server = await FakeResp.start();
        server.delayMs = 20; // el handshake tarda un poco
        try {
            await withCluster([node(server)], undefined, OPTIONS, async cluster => {
                const client = await cluster.single; // sin esperar antes: el cliente aún no está listo al pedirlo
                assert.equal(client.isReady, true);
            });
        } finally {
            await server.stop();
        }
    });

    it("si nunca ha conectado, tras esperar a la conexión inicial rechaza con ClientOfflineError", async () => {
        const server = await FakeResp.start();
        const address = node(server);
        await server.stop();
        try {
            await withCluster([address], undefined, {...OPTIONS, clientTimeout: 40}, async cluster => {
                const start = Date.now();
                await assert.rejects(cluster.single, ClientOfflineError);
                assert.ok(Date.now() - start >= 700, "espera la ventana de gracia: 4 × clientTimeout + 700 ms");
                assert.ok(Date.now() - start < 8_000);
                await assert.rejects(cluster.read, ClientOfflineError);
                await assert.rejects(Promise.all(cluster.primaries), ClientOfflineError);

                // Pasada la ventana inicial, con Redis caído desde el principio, cada operación falla al instante.
                const second = Date.now();
                await assert.rejects(cluster.single, ClientOfflineError);
                assert.ok(Date.now() - second < 500);
            });
        } finally {
            await server.stop();
        }
    });

    it("no se rinde: sigue reintentando con el servidor caído y conecta cuando vuelve, con el mismo cliente", async () => {
        const server = await FakeResp.start();
        try {
            await withCluster([node(server)], undefined, {maxReconnectDelayMs: 20, logThrottleMs: 0}, async cluster => {
                const client = await cluster.single;

                await server.stop();
                await sleep(1_500); // al menos 5 intentos fallidos (cada espera dura como mucho ~270 ms)
                assert.equal(client.isReady, false);
                assert.equal(client.isOpen, true);

                await server.resume();
                await waitUntil(() => client.isReady, "que reconecte");
                assert.equal(await cluster.single, client);
            });
        } finally {
            await server.stop();
        }
    });

    it("tras un parpadeo (corte con el servidor aceptando) sigue siendo el mismo cliente y se recupera", async () => {
        const server = await FakeResp.start();
        try {
            await withCluster([node(server)], undefined, OPTIONS, async cluster => {
                const client = await cluster.single;
                server.cut();
                await waitUntil(() => server.connections === 2 && client.isReady, "que reconecte");
                assert.equal(await cluster.single, client);
                assert.equal(server.connections, 2);
            });
        } finally {
            await server.stop();
        }
    });

    it("una vez conectado, si cae falla al instante (no espera a que vuelva) y sin cola offline", async () => {
        const server = await FakeResp.start();
        try {
            await withCluster([node(server)], undefined, {...OPTIONS, timeout: 200}, async cluster => {
                const client: RedisClientType = await cluster.single;
                await server.stop();
                await waitUntil(() => !client.isReady, "que detecte la caída");

                const start = Date.now();
                await assert.rejects(cluster.single, ClientOfflineError);
                await assert.rejects(cluster.read, ClientOfflineError);
                assert.ok(Date.now() - start < 500, "pedir el cliente ya no espera");

                // Un comando directo sobre el cliente caído tampoco se encola hasta el timeout: se rechaza al momento.
                const commandStart = Date.now();
                await assert.rejects(client.get("k"), ClientOfflineError);
                assert.ok(Date.now() - commandStart < 500);
            });
        } finally {
            await server.stop();
        }
    });

    it("el timeout de los comandos es el pedido (por defecto 10 ms)", async () => {
        // `commandOptions.timeout` de node-redis 6.3.0 solo acota la espera previa al envío, no la respuesta, así que no se puede probar con un servidor lento:
        // se comprueba lo que se le configuró al cliente (propiedad interna `_commandOptions`).
        const commandTimeout = (client: RedisClientType): number | undefined => (client as unknown as {_commandOptions?: {timeout?: number}})._commandOptions?.timeout;
        const server = await FakeResp.start();
        try {
            await withCluster([node(server)], undefined, {...OPTIONS, timeout: 400}, async cluster => {
                assert.equal(commandTimeout(await cluster.single), 400);
            });
            await withCluster([node(server)], undefined, OPTIONS, async cluster => {
                assert.equal(commandTimeout(await cluster.single), 10);
            });
        } finally {
            await server.stop();
        }
    });

    it("si read es el mismo host y puerto que un primario, comparte su cliente; si no, tiene el suyo", async () => {
        const a = await FakeResp.start();
        const b = await FakeResp.start();
        try {
            await withCluster([node(a)], node(a), OPTIONS, async cluster => {
                assert.equal(await cluster.read, await cluster.single);
            });
            await withCluster([node(a)], node(b), OPTIONS, async cluster => {
                assert.notEqual(await cluster.read, await cluster.single);
            });
        } finally {
            await a.stop();
            await b.stop();
        }
    });

    it("se puede liberar con el servidor caído, sin esperar a que vuelva", async () => {
        const server = await FakeResp.start();
        const cluster = new RedisCluster([node(server)], undefined, OPTIONS);
        try {
            const client = await cluster.single;
            await server.stop();
            await waitUntil(() => !client.isReady, "que detecte la caída");

            const start = Date.now();
            await cluster[Symbol.asyncDispose]();
            assert.ok(Date.now() - start < 5_000);
            assert.equal(client.isOpen, false);
        } finally {
            await server.stop();
        }
    });

    it("un `ready` que llega después de liberar el clúster (handshake que termina tarde) destruye esa conexión en vez de dejarla viva", async () => {
        const server = await FakeResp.start();
        const address = node(server);
        await server.stop();
        const cluster = new RedisCluster([address], undefined, OPTIONS);
        const client = (cluster as unknown as {clients: RedisClientType[]}).clients[0];
        const destroy = client.destroy.bind(client);
        let destroyed = 0;
        client.destroy = () => {
            destroyed++;
            destroy();
        };
        try {
            await cluster[Symbol.asyncDispose]();
            const afterDispose = destroyed;
            client.emit("ready"); // lo que node-redis 6.3.0 emite si el handshake termina después del `destroy()`
            assert.equal(destroyed, afterDispose + 1, "el `ready` tardío tiene que destruir la conexión");
        } finally {
            destroy();
        }
    });

    it("antes de liberar, un `ready` normal no destruye nada", async () => {
        const server = await FakeResp.start();
        try {
            await withCluster([node(server)], undefined, OPTIONS, async cluster => {
                const client = await cluster.single;
                const destroy = client.destroy.bind(client);
                let destroyed = 0;
                client.destroy = () => {
                    destroyed++;
                    destroy();
                };
                client.emit("ready");
                assert.equal(destroyed, 0);
                assert.equal(client.isReady, true);
                client.destroy = destroy;
            });
        } finally {
            await server.stop();
        }
    });

    it("liberar no lanza aunque `destroy()` lance (versiones de node-redis anteriores a la 6.3)", async () => {
        const server = await FakeResp.start();
        const address = node(server);
        await server.stop();
        const cluster = new RedisCluster([address], undefined, OPTIONS);
        const client = (cluster as unknown as {clients: RedisClientType[]}).clients[0];
        const destroy = client.destroy.bind(client);
        client.destroy = () => {
            throw new Error("destroy lanza");
        };
        try {
            await assert.doesNotReject(cluster[Symbol.asyncDispose]());
        } finally {
            client.destroy = destroy;
            destroy();
        }
    });

    it("el tope de reconexión por defecto es de 5 s (más hasta 250 ms de azar)", async () => {
        const server = await FakeResp.start();
        try {
            await withCluster([node(server)], undefined, {logThrottleMs: 0}, async cluster => {
                const client = await cluster.single;
                const strategy = (client as unknown as {options?: {socket?: {reconnectStrategy?: (retries: number, cause: Error) => unknown}}}).options?.socket?.reconnectStrategy;
                assert.equal(typeof strategy, "function");
                for (const retries of [10, 100, 1_000]) {
                    const delay = (strategy as (retries: number, cause: Error) => number)(retries, new Error("x"));
                    assert.ok(delay >= 5_000 && delay < 5_250, `${delay} ms`);
                }
            });
        } finally {
            await server.stop();
        }
    });

    it("liberarlo dos veces es inocuo, y cierra todas las conexiones", async () => {
        const a = await FakeResp.start();
        const b = await FakeResp.start();
        const cluster = new RedisCluster([node(a)], node(b), OPTIONS);
        try {
            await Promise.all(cluster.primaries);
            await cluster.read;
            await Promise.all([cluster[Symbol.asyncDispose](), cluster[Symbol.asyncDispose]()]);
            await cluster[Symbol.asyncDispose]();
            await waitUntil(() => a.open === 0 && b.open === 0, "que se cierren");
        } finally {
            await a.stop();
            await b.stop();
        }
    });
});
