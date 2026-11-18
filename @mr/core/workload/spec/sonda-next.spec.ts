/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 16:37:03 GMT
 * Hash: 408f1ff7caf1ca69e2d0d830de1ca7cd
 * Versión: 2026.11.16+5-bixus
 * Anterior: 2026.11.16+4-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type {AddressInfo} from "node:net";
import {mkdtemp, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {NOMBRE_LOCK_APAGADO} from "../engine/lock";
import {Sonda} from "../heartbeat/sonda";
import {AdaptadorNext, INTERVALO_AUTOSONDEO_MS, MARGEN_SONDA_MS, PLAZO_NO_LISTO_MS, MAX_REDIRECCIONES, consultarHttp, respuestaBuena} from "../heartbeat/next/sonda-next";

/**
 * El adaptador que hace de `Engine` para un servicio Next: autosondeo de `/admin/started` y `/admin/ready`, y vigilante de
 * `shutdown.lock`.
 */

const esperar = async (ms: number): Promise<void> => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

const hasta = async (condicion: () => boolean, ms = 1000): Promise<void> => {
    const t0 = Date.now();
    while (!condicion() && Date.now() - t0 < ms) {
        await esperar(5);
    }
};

const existe = async (ruta: string): Promise<boolean> => stat(ruta).then(() => true, () => false);

const conCarpeta = async (prueba: (dir: string) => Promise<void>): Promise<void> => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sonda-next-"));
    try {
        await prueba(dir);
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
};

describe("respuestaBuena", () => {
    it("200 a 399 son buenas, como en el kubelet; todo lo demás no", () => {
        for (const codigo of [200, 204, 301, 302, 399]) {
            assert.equal(respuestaBuena(codigo), true, String(codigo));
        }
        for (const codigo of [0, 199, 400, 404, 500, 503]) {
            assert.equal(respuestaBuena(codigo), false, String(codigo));
        }
    });
});

describe("AdaptadorNext: started() y ready()", () => {
    it("sondean /admin/started y /admin/ready (sin barra final) en 127.0.0.1 con el puerto y el tiempo configurados", async () => {
        const vistas: string[] = [];
        const adaptador = new AdaptadorNext({puerto: 8080, timeoutMs: 321, consultar: async (url, ms) => { vistas.push(`${url} ${ms}`); return 200; }});
        await adaptador.started();
        await adaptador.ready();
        assert.deepEqual(vistas, ["http://127.0.0.1:8080/admin/started 321", `http://127.0.0.1:8080/admin/ready ${321 - MARGEN_SONDA_MS}`]);
    });

    it("nunca pide con barra final (costaría un 308 más cada segundo)", async () => {
        const vistas: string[] = [];
        const adaptador = new AdaptadorNext({puerto: 1, consultar: async (url) => { vistas.push(url); return 200; }});
        await adaptador.started();
        await adaptador.ready();
        assert.equal(vistas.length, 2);
        for (const url of vistas) {
            assert.ok(!url.endsWith("/"), url);
        }
    });

    it("200 y 3xx resuelven; 4xx y 5xx rechazan", async () => {
        let codigo = 200;
        const adaptador = new AdaptadorNext({puerto: 1, intervaloSondeoMs: 0, plazoNoListoMs: 0, consultar: async () => codigo});
        for (const bueno of [200, 204, 301, 302]) {
            codigo = bueno;
            await adaptador.ready();
        }
        for (const malo of [400, 404, 500, 503]) {
            codigo = malo;
            await assert.rejects(adaptador.ready(), new RegExp(String(malo)));
        }
    });

    it("un timeout o un ECONNREFUSED de la consulta rechazan", async () => {
        const adaptador = new AdaptadorNext({puerto: 1, intervaloSondeoMs: 0, plazoNoListoMs: 0, consultar: async () => { throw new Error("connect ECONNREFUSED 127.0.0.1:1"); }});
        await assert.rejects(adaptador.ready(), /ECONNREFUSED/);
        await assert.rejects(adaptador.started(), /ECONNREFUSED/);
    });

    it("el puerto por defecto es process.env.PORT, y si no hay, 3000", async () => {
        const antes = process.env["PORT"];
        try {
            const vistas: string[] = [];
            const consultar = async (url: string): Promise<number> => { vistas.push(url); return 200; };
            process.env["PORT"] = "8123";
            await new AdaptadorNext({consultar}).ready();
            delete process.env["PORT"];
            await new AdaptadorNext({consultar}).ready();
            assert.deepEqual(vistas, ["http://127.0.0.1:8123/admin/ready", "http://127.0.0.1:3000/admin/ready"]);
        } finally {
            if (antes === undefined) {
                delete process.env["PORT"];
            } else {
                process.env["PORT"] = antes;
            }
        }
    });

    it("con la Sonda real: arrancando -> listo -> no-listo -> listo", async () => {
        let started = false;
        let ready = false;
        const adaptador = new AdaptadorNext({
            puerto: 1,
            intervaloSondeoMs: 0, plazoNoListoMs: 0,
            consultar: async (url) => {
                if (url.endsWith("/admin/started")) {
                    return started ? 200 : 503;
                }

                return ready ? 200 : 503;
            },
        });
        const sonda = new Sonda();
        sonda.setEngine(adaptador);

        assert.equal((await sonda.evaluar()).estado, "arrancando", "sin ejecutado");
        sonda.marcarEjecutado();
        assert.equal((await sonda.evaluar()).estado, "arrancando", "started() todavía no contesta bien");
        started = true;
        ready = true;
        assert.equal((await sonda.evaluar()).estado, "listo");
        ready = false;
        assert.equal((await sonda.evaluar()).estado, "no-listo");
        ready = true;
        assert.equal((await sonda.evaluar()).estado, "listo");
    });
});

describe("AdaptadorNext: ready() sondea cada 5 s y tolera 10 s", () => {
    interface IBanco {
        adaptador: AdaptadorNext;
        peticiones: string[];
        avanzar: (ms: number) => void;
        bien: (ok: boolean) => void;
    }

    const banco = (extra: {existeLock?: () => Promise<boolean>} = {}): IBanco => {
        let reloj = 1_000_000;
        let ok = true;
        const peticiones: string[] = [];
        const adaptador = new AdaptadorNext({
            puerto: 1,
            ahora: () => reloj,
            consultar: async (url) => { peticiones.push(url); return ok ? 200 : 503; },
            ...extra,
        });

        return {adaptador, peticiones, avanzar: (ms) => { reloj += ms; }, bien: (v) => { ok = v; }};
    };

    it("los valores por defecto: sondeo cada 5 s y no-listo a los 10 s", () => {
        assert.equal(INTERVALO_AUTOSONDEO_MS, 5000);
        assert.equal(PLAZO_NO_LISTO_MS, 10_000);
    });

    it("sondea como mucho una vez cada 5 s aunque ready() se llame cada segundo", async () => {
        const b = banco();
        for (let s = 0; s < 12; s++) {
            await b.adaptador.ready();
            b.avanzar(1000);
        }
        assert.equal(b.peticiones.length, 3, "a los 0, 5 y 10 s");
    });

    it("las llamadas simultáneas comparten un solo sondeo", async () => {
        const b = banco();
        await Promise.all([b.adaptador.ready(), b.adaptador.ready(), b.adaptador.ready()]);
        assert.equal(b.peticiones.length, 1);
    });

    it("un fallo aislado no da no-listo y 10 s seguidos fallando sí", async () => {
        const b = banco();
        const sonda = new Sonda();
        sonda.setEngine(b.adaptador);
        sonda.marcarEjecutado();
        assert.equal((await sonda.evaluar()).estado, "listo", "t=0");
        b.bien(false);
        for (let s = 1; s <= 9; s++) {
            b.avanzar(1000);
            assert.equal((await sonda.evaluar()).estado, "listo", `t=${s} s (un fallo a los 5 s)`);
        }
        b.avanzar(1000);
        assert.equal((await sonda.evaluar()).estado, "no-listo", "t=10 s: segundo fallo seguido");
        b.avanzar(1000);
        assert.equal((await sonda.evaluar()).estado, "no-listo", "entre sondeos sigue");
        b.bien(true);
        b.avanzar(4000);
        assert.equal((await sonda.evaluar()).estado, "listo", "t=15 s: un éxito recupera");
    });

    it("un éxito intermedio reinicia la cuenta", async () => {
        const b = banco();
        await b.adaptador.ready();
        b.bien(false);
        b.avanzar(5000);
        await b.adaptador.ready();
        b.bien(true);
        b.avanzar(5000);
        await b.adaptador.ready();
        b.bien(false);
        b.avanzar(5000);
        await b.adaptador.ready();
        b.avanzar(5000);
        await assert.rejects(b.adaptador.ready(), /503/);
    });

    it("los plazos son inyectables", async () => {
        let reloj = 0;
        const adaptador = new AdaptadorNext({puerto: 1, intervaloSondeoMs: 100, plazoNoListoMs: 300, ahora: () => reloj, consultar: async () => 503});
        for (const t of [0, 100, 200]) {
            reloj = t;
            await adaptador.ready();
        }
        reloj = 300;
        await assert.rejects(adaptador.ready(), /503/);
    });

    it("con el lock, drenando es inmediato aunque el sondeo vaya bien", async () => {
        const b = banco({existeLock: async () => true});
        const sonda = new Sonda();
        sonda.setEngine(b.adaptador);
        sonda.marcarEjecutado();
        assert.equal((await sonda.evaluar()).estado, "listo");
        await b.adaptador.vigilarLock(() => undefined);
        await hasta(() => b.adaptador.preStopSolicitado);
        assert.equal((await sonda.evaluar()).estado, "drenando");
        b.adaptador.detener();
    });

    it("started() se pide solo hasta el primer éxito (la Sonda no vuelve a llamarlo) y entonces ya es listo", async () => {
        const b = banco();
        const sonda = new Sonda();
        sonda.setEngine(b.adaptador);
        sonda.marcarEjecutado();
        await sonda.evaluar();
        await sonda.evaluar();
        b.avanzar(1000);
        await sonda.evaluar();
        assert.equal(b.peticiones.filter((u) => u.endsWith("/admin/started")).length, 1);
    });
});

describe("AdaptadorNext: shutdown.lock", () => {
    it("un lock que aparece da drenando(prestop), avisa una sola vez y deja de vigilar", async () => {
        let hay = false;
        let consultas = 0;
        let avisos = 0;
        let miradas = 0;
        const adaptador = new AdaptadorNext({
            puerto: 1,
            intervaloLockMs: 5,
            existeLock: async () => { miradas++; return hay; },
            consultar: async () => { consultas++; return 200; },
        });
        const sonda = new Sonda();
        sonda.setEngine(adaptador);
        sonda.marcarEjecutado();
        await adaptador.vigilarLock(() => { avisos++; });

        assert.equal((await sonda.evaluar()).estado, "listo");
        const antes = consultas;
        assert.ok(antes >= 2);
        assert.equal(adaptador.preStopSolicitado, false);

        hay = true;
        await hasta(() => avisos > 0);
        assert.equal(adaptador.preStopSolicitado, true);
        assert.equal(avisos, 1);

        const lectura = await sonda.evaluar();
        assert.equal(lectura.estado, "drenando");
        assert.equal(lectura.causaDrenado, "prestop");
        assert.equal(consultas, antes, "tras el lock no hay más autosondeos");

        const miradasAlDetectar = miradas;
        await esperar(40);
        assert.equal(avisos, 1);
        assert.equal(miradas, miradasAlDetectar, "ya no se vigila");
    });

    it("borra un shutdown.lock anterior (reinicio por liveness) antes de vigilar, y luego lo detecta", async () => {
        await conCarpeta(async (dir) => {
            const lock = path.join(dir, NOMBRE_LOCK_APAGADO);
            await writeFile(lock, "");
            let avisos = 0;
            const adaptador = new AdaptadorNext({puerto: 1, dir, intervaloLockMs: 5});
            await adaptador.vigilarLock(() => { avisos++; });
            assert.equal(await existe(lock), false);
            await esperar(40);
            assert.equal(adaptador.preStopSolicitado, false, "el lock viejo no cuenta");
            assert.equal(avisos, 0);

            await writeFile(lock, "");
            await hasta(() => avisos > 0);
            assert.equal(adaptador.preStopSolicitado, true);
            adaptador.detener();
        });
    });

    it("el temporizador del vigilante no mantiene vivo el proceso", async () => {
        await conCarpeta(async (dir) => {
            const adaptador = new AdaptadorNext({puerto: 1, dir});
            await adaptador.vigilarLock(() => undefined);
            const timer = (adaptador as unknown as {timerLock: NodeJS.Timeout|null}).timerLock;
            assert.ok(timer !== null);
            assert.equal(timer.hasRef(), false);
            adaptador.detener();
            assert.equal((adaptador as unknown as {timerLock: NodeJS.Timeout|null}).timerLock, null);
        });
    });

    it("un existeLock que lanza no rompe el vigilante", async () => {
        let llamadas = 0;
        let avisos = 0;
        const adaptador = new AdaptadorNext({
            puerto: 1,
            intervaloLockMs: 5,
            existeLock: async () => { llamadas++; if (llamadas < 3) { throw new Error("EIO"); } return true; },
        });
        await adaptador.vigilarLock(() => { avisos++; });
        await hasta(() => avisos > 0);
        assert.equal(avisos, 1);
        assert.equal(adaptador.preStopSolicitado, true);
    });
});

describe("consultarHttp", () => {
    const conServidor = async (prueba: (puerto: number, cabeceras: http.IncomingHttpHeaders[]) => Promise<void>): Promise<void> => {
        const cabeceras: http.IncomingHttpHeaders[] = [];
        const servidor = http.createServer((req, res) => {
            cabeceras.push(req.headers);
            switch (req.url) {
                case "/ok":
                    res.writeHead(200, {"Content-Type": "application/json"});
                    res.end("{\"ok\":true}");
                    break;
                case "/redireccion":
                    res.writeHead(302, {Location: "/ok"});
                    res.end();
                    break;
                case "/barra":
                    res.writeHead(308, {Location: `http://${req.headers.host}/ok`});
                    res.end();
                    break;
                case "/a-error":
                    res.writeHead(307, {Location: "/error"});
                    res.end();
                    break;
                case "/otro-host":
                    res.writeHead(302, {Location: "http://otro-host.invalid/ready"});
                    res.end();
                    break;
                case "/otro-nombre":
                    res.writeHead(302, {Location: `http://localhost:${req.socket.localPort}/ok`});
                    res.end();
                    break;
                case "/otro-puerto":
                    res.writeHead(302, {Location: "http://127.0.0.1:1/ready"});
                    res.end();
                    break;
                case "/https":
                    res.writeHead(301, {Location: `https://${req.headers.host}/ok`});
                    res.end();
                    break;
                case "/sin-location":
                    res.writeHead(302);
                    res.end();
                    break;
                case "/bucle":
                    res.writeHead(302, {Location: "/bucle"});
                    res.end();
                    break;
                case "/lento-tras-salto":
                    res.writeHead(302, {Location: "/lento"});
                    res.end();
                    break;
                case "/error":
                    res.writeHead(500);
                    res.end();
                    break;
                default: {
                    const demora = /^\/demora\/(\d+)$/.exec(req.url ?? "");
                    if (demora !== null) {
                        const n = Number(demora[1]);
                        setTimeout(() => {
                            res.writeHead(n === 0 ? 200 : 302, n === 0 ? {} : {Location: `/demora/${n - 1}`});
                            res.end();
                        }, 100);
                    }
                    const salto = /^\/salto\/(\d+)$/.exec(req.url ?? "");
                    if (salto !== null) {
                        const n = Number(salto[1]);
                        if (n === 0) {
                            res.writeHead(200);
                            res.end();
                        } else {
                            res.writeHead(302, {Location: `/salto/${n - 1}`});
                            res.end();
                        }
                    }
                    // Lo demás no contesta nunca.
                    break;
                }
            }
        });
        await new Promise<void>((resolve) => { servidor.listen(0, "127.0.0.1", resolve); });
        try {
            await prueba((servidor.address() as AddressInfo).port, cabeceras);
        } finally {
            servidor.closeAllConnections();
            await new Promise<void>((resolve) => { servidor.close(() => { resolve(); }); });
        }
    };

    it("devuelve el código tal cual y pide Connection: close", async () => {
        await conServidor(async (puerto, cabeceras) => {
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/ok`, 500), 200);
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/error`, 500), 500);
            assert.equal(cabeceras.length, 2);
            for (const cabecera of cabeceras) {
                assert.equal(cabecera.connection, "close");
            }
        });
    });

    it("sigue las redirecciones a la misma máquina, relativas o absolutas, cada una con su conexión", async () => {
        await conServidor(async (puerto, cabeceras) => {
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/redireccion`, 500), 200);
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/barra`, 500), 200);
            assert.equal(cabeceras.length, 4, "dos peticiones por consulta");
            for (const cabecera of cabeceras) {
                assert.equal(cabecera.connection, "close");
            }
        });
    });

    it("el resultado es el del destino de la redirección: un 5xx tras seguirla es un 5xx", async () => {
        await conServidor(async (puerto) => {
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/a-error`, 500), 500);
        });
    });

    it("una redirección a otro host, otro puerto o https no se sigue y devuelve el 3xx (el kubelet la da por buena)", async () => {
        await conServidor(async (puerto, cabeceras) => {
            for (const ruta of ["/otro-host", "/otro-nombre", "/otro-puerto", "/https"]) {
                const codigo = await consultarHttp(`http://127.0.0.1:${puerto}${ruta}`, 500);
                assert.ok(respuestaBuena(codigo), ruta);
            }
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/otro-host`, 500), 302);
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/https`, 500), 301);
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/otro-nombre`, 500), 302);
            assert.equal(cabeceras.length, 7, "una petición por consulta");
        });
    });

    it("una redirección sin Location devuelve el 3xx", async () => {
        await conServidor(async (puerto) => {
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/sin-location`, 500), 302);
        });
    });

    it("sigue hasta 10 saltos y con más rechaza, como el kubelet (también un bucle)", async () => {
        await conServidor(async (puerto) => {
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/salto/${MAX_REDIRECCIONES}`, 2000), 200);
            await assert.rejects(consultarHttp(`http://127.0.0.1:${puerto}/salto/${MAX_REDIRECCIONES + 1}`, 2000), /más de 10 redirecciones/);
            await assert.rejects(consultarHttp(`http://127.0.0.1:${puerto}/bucle`, 2000), /más de 10 redirecciones/);
        });
    });

    it("cada salto tarda poco pero el tiempo es el total: cinco saltos de 100 ms no caben en 250 ms", {timeout: 3000}, async () => {
        await conServidor(async (puerto) => {
            assert.equal(await consultarHttp(`http://127.0.0.1:${puerto}/demora/1`, 1000), 200);
            await assert.rejects(consultarHttp(`http://127.0.0.1:${puerto}/demora/5`, 250), /sin respuesta en 250 ms/);
        });
    });

    it("el tiempo es el tope total de todos los saltos", {timeout: 3000}, async () => {
        await conServidor(async (puerto) => {
            const t0 = Date.now();
            await assert.rejects(consultarHttp(`http://127.0.0.1:${puerto}/lento-tras-salto`, 150), /sin respuesta en 150 ms/);
            assert.ok(Date.now() - t0 < 600);
        });
    });

    it("se aborta al vencer el tiempo", {timeout: 3000}, async () => {
        await conServidor(async (puerto) => {
            const t0 = Date.now();
            await assert.rejects(consultarHttp(`http://127.0.0.1:${puerto}/lento`, 80), /sin respuesta en 80 ms/);
            assert.ok(Date.now() - t0 < 500);
        });
    });

    it("rechaza si no hay nadie escuchando (ECONNREFUSED)", async () => {
        const servidor = http.createServer();
        await new Promise<void>((resolve) => { servidor.listen(0, "127.0.0.1", resolve); });
        const puerto = (servidor.address() as AddressInfo).port;
        await new Promise<void>((resolve) => { servidor.close(() => { resolve(); }); });
        await assert.rejects(consultarHttp(`http://127.0.0.1:${puerto}/`, 500), /ECONNREFUSED/);
    });
});
