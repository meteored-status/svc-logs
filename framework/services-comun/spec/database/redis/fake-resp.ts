/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 16e98ee106e8a9ac0c761f6e8cda241c
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

/**
 * Servidor RESP2 falso, mínimo, para probar el cliente Redis contra una conexión real (de bucle local) sin Redis. Responde lo justo para que
 * node-redis conecte y para los comandos que usan las pruebas, y se puede cortar, parar, reanudar o dejar mudo.
 */

import net from "node:net";

interface IConnectionState {
    resp3: boolean;
    multi: boolean;
    queue: string[][];
    buffer: Buffer;
}

/**
 * Extrae del búfer todos los comandos completos (arrays RESP de cadenas) y devuelve lo que sobra.
 */
function parse(buffer: Buffer): {commands: string[][]; rest: Buffer} {
    const commands: string[][] = [];
    let pos = 0;
    while (pos < buffer.length) {
        if (buffer[pos] !== 0x2a) { // '*'
            throw new Error(`RESP no soportado: ${buffer.toString("utf8", pos, pos + 20)}`);
        }
        const end = buffer.indexOf("\r\n", pos);
        if (end < 0) {
            break;
        }
        const total = parseInt(buffer.toString("utf8", pos + 1, end), 10);
        let cursor = end + 2;
        const args: string[] = [];
        let complete = true;
        for (let i = 0; i < total; i++) {
            const lineEnd = buffer.indexOf("\r\n", cursor);
            if (lineEnd < 0) {
                complete = false;
                break;
            }
            const length = parseInt(buffer.toString("utf8", cursor + 1, lineEnd), 10);
            if (lineEnd + 2 + length + 2 > buffer.length) {
                complete = false;
                break;
            }
            args.push(buffer.toString("utf8", lineEnd + 2, lineEnd + 2 + length));
            cursor = lineEnd + 2 + length + 2;
        }
        if (!complete) {
            break;
        }
        commands.push(args);
        pos = cursor;
    }
    return {commands, rest: buffer.subarray(pos)};
}

/**
 * Servidor Redis falso.
 *
 * - `HINCRBY`, `HSET` y `HGETALL` funcionan sobre `hashes`; `SET`, `EXPIRE`, `ZADD` y el resto responden lo mínimo.
 * - `EVAL` responde `evalResult`.
 * - Con `mute` acepta conexiones y comandos pero no responde nunca.
 * - Con `delayMs` mayor que 0 responde a todo con ese retraso (en orden), como un Redis lento.
 */
export class FakeResp {
    /* STATIC */

    /**
     * Crea el servidor y empieza a escuchar en un puerto libre de `127.0.0.1`.
     */
    public static async start(): Promise<FakeResp> {
        const server = new FakeResp();
        await server.listen();
        return server;
    }

    /* INSTANCE */

    public readonly commands: string[][];
    public readonly hashes: Map<string, Map<string, string>>;
    public mute: boolean;
    public delayMs: number;
    public evalResult: number;
    public connections: number;
    private _port: number;
    private server: net.Server | null;
    private readonly sockets: Set<net.Socket>;

    public get port(): number {
        return this._port;
    }

    /**
     * Conexiones abiertas ahora mismo.
     */
    public get open(): number {
        return this.sockets.size;
    }

    private constructor() {
        this.commands = [];
        this.hashes = new Map();
        this.mute = false;
        this.delayMs = 0;
        this.evalResult = 1;
        this.connections = 0;
        this._port = 0;
        this.server = null;
        this.sockets = new Set();
    }

    /**
     * Comandos recibidos con ese nombre (`SET`, `EXEC`...), en orden de llegada.
     */
    public seen(command: string): string[][] {
        return this.commands.filter(args => args[0].toUpperCase() === command.toUpperCase());
    }

    /**
     * Deja un hash cargado, para probar lecturas.
     */
    public preloadHash(key: string, fields: Record<string, string>): void {
        this.hashes.set(key, new Map(Object.entries(fields)));
    }

    /**
     * Corta las conexiones abiertas pero sigue aceptando nuevas (un parpadeo).
     */
    public cut(): void {
        for (const socket of this.sockets) {
            socket.destroy();
        }
    }

    /**
     * Corta las conexiones y deja de aceptar (Redis caído: las conexiones nuevas son rechazadas).
     */
    public async stop(): Promise<void> {
        this.cut();
        const server = this.server;
        if (server !== null) {
            this.server = null;
            await new Promise<void>(resolve => {
                server.close(() => {
                    resolve();
                });
            });
        }
    }

    /**
     * Vuelve a aceptar conexiones en el mismo puerto.
     */
    public async resume(): Promise<void> {
        await this.listen();
    }

    private listen(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const server = net.createServer(socket => {
                this.connections++;
                this.sockets.add(socket);
                const state: IConnectionState = {resp3: false, multi: false, queue: [], buffer: Buffer.alloc(0)};
                socket.on("data", (data: Buffer) => {
                    state.buffer = Buffer.concat([state.buffer, data]);
                    const {commands, rest} = parse(state.buffer);
                    state.buffer = rest;
                    for (const args of commands) {
                        this.commands.push(args);
                        this.respond(socket, state, args);
                    }
                });
                socket.on("error", () => undefined);
                socket.on("close", () => {
                    this.sockets.delete(socket);
                });
            });
            server.once("error", reject);
            server.listen(this._port, "127.0.0.1", () => {
                this._port = (server.address() as net.AddressInfo).port;
                this.server = server;
                resolve();
            });
        });
    }

    private send(socket: net.Socket, text: string): void {
        if (this.delayMs <= 0) {
            socket.write(text);
            return;
        }
        setTimeout(() => {
            if (!socket.destroyed) {
                socket.write(text);
            }
        }, this.delayMs);
    }

    private respond(socket: net.Socket, state: IConnectionState, args: string[]): void {
        if (this.mute) {
            return;
        }
        const command = args[0].toUpperCase();
        if (state.multi && command !== "EXEC" && command !== "DISCARD") {
            state.queue.push(args);
            this.send(socket, "+QUEUED\r\n");
            return;
        }
        switch (command) {
            case "MULTI":
                state.multi = true;
                state.queue = [];
                this.send(socket, "+OK\r\n");
                return;
            case "EXEC": {
                const queue = state.queue;
                state.multi = false;
                state.queue = [];
                this.send(socket, `*${queue.length}\r\n${queue.map(queued => this.result(queued, state)).join("")}`);
                return;
            }
            case "QUIT":
                this.send(socket, "+OK\r\n");
                setTimeout(() => {
                    socket.end();
                }, this.delayMs);
                return;
            case "HELLO": // node-redis 6 negocia RESP3 al conectar
                state.resp3 = args[1] === "3";
                this.send(socket, state.resp3 ? "%1\r\n$6\r\nserver\r\n$5\r\nredis\r\n" : "-ERR unknown command 'HELLO'\r\n");
                return;
            default:
                this.send(socket, this.result(args, state));
        }
    }

    private result(args: string[], state: IConnectionState): string {
        switch (args[0].toUpperCase()) {
            case "PING":
                return "+PONG\r\n";
            case "GET":
                return "$-1\r\n";
            case "EVAL":
                return `:${this.evalResult}\r\n`;
            case "HINCRBY": {
                const [, key, field, increment] = args;
                const hash = this.hashes.get(key) ?? new Map<string, string>();
                this.hashes.set(key, hash);
                const value = Number(hash.get(field) ?? 0) + Number(increment);
                hash.set(field, String(value));
                return `:${value}\r\n`;
            }
            case "HSET": {
                const [, key, field, value] = args;
                const hash = this.hashes.get(key) ?? new Map<string, string>();
                this.hashes.set(key, hash);
                hash.set(field, value);
                return ":1\r\n";
            }
            case "HGETALL": {
                const hash = this.hashes.get(args[1]);
                if (hash === undefined || hash.size === 0) {
                    return state.resp3 ? "%0\r\n" : "*0\r\n";
                }
                let output = state.resp3 ? `%${hash.size}\r\n` : `*${hash.size * 2}\r\n`;
                for (const [field, value] of hash) {
                    output += `$${Buffer.byteLength(field)}\r\n${field}\r\n$${Buffer.byteLength(value)}\r\n${value}\r\n`;
                }
                return output;
            }
            case "EXPIRE":
            case "ZADD":
                return ":1\r\n";
            default: // SET, CLIENT, ...
                return "+OK\r\n";
        }
    }
}
