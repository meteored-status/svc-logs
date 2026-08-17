/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: b2e0ab9f38947a22661f1db02c0a39ea
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {BulkBase, type BulkConfig} from "./base";
import {BulkError} from "./error";
import {Elasticsearch} from "../index";
import {error} from "../../utiles/log";
import {
    type BulkOperation,
} from "./operation";
import {arrayChop} from "../../utiles/array";
import {PromiseDelayed} from "../../utiles/promise";

/**
 * Envía las operaciones encoladas en {@link BulkBase} en una sola tanda: {@link run} las agrupa
 * en bloques de {@link BulkConfig.blockSize} y los envía en paralelo. Un item con error 429
 * (rate limit) no se reintenta en el mismo bloque: se vuelve a encolar en `operaciones` para
 * enviarse en la siguiente vuelta de {@link ejecutar}, dando tiempo a que el clúster se recupere
 * antes de reintentarlo con el mismo bloque exacto (con backoff lineal entre vueltas). Un fallo de
 * la petición completa (excepción, no error por item) sí se reintenta en el propio bloque, hasta
 * 8 veces, también con backoff lineal entre intentos.
 */
export class Bulk extends BulkBase {
    /* STATIC */
    public static init(elastic: Elasticsearch, config: BulkConfig={}): Bulk {
        return new this(elastic, config);
    }

    /* INSTANCE */
    public correctos: number;
    public erroneos: number;
    public finalizado: boolean;
    public length: number;
    public ok: boolean;
    public tiempoEnvio: number;
    public tiempoTotal: number;

    private readonly start: number;

    protected constructor(elastic: Elasticsearch, config: BulkConfig) {
        super(elastic, config);

        this.correctos = 0;
        this.erroneos = 0;
        this.finalizado = false;
        this.length = 0;
        this.ok = false;
        this.tiempoEnvio = 0;
        this.tiempoTotal = 0;

        this.start = Date.now();
    }

    protected override checkOperacion(index?: string): string {
        if (this.finalizado) {
            throw new BulkError("This Bulk is closed");
        }

        return super.checkOperacion(index);
    }

    public add(...ops: BulkOperation[]): void {
        for (const op of ops) {
            this.push(op);
        }
    }

    protected override push(op: BulkOperation): BulkOperation {
        this.length++;
        return super.push(op);
    }

    /** Envía todas las operaciones encoladas. Solo tiene efecto la primera vez; llamadas posteriores devuelven el resultado ya obtenido. */
    public async run(): Promise<boolean> {
        if (this.finalizado) {
            return this.ok;
        }

        this.finalizado = true;

        const start = Date.now();
        this.ok = await this.ejecutar();
        this.tiempoEnvio = Date.now() - start;
        this.tiempoTotal = Date.now() - this.start;

        return this.ok;
    }

    /**
     * Envía en paralelo todos los bloques con lo que haya en `operaciones` en este momento y,
     * si al terminar hay operaciones nuevas (los reintentos por 429 de {@link ejecutarBloque} las
     * vuelven a encolar), espera un backoff lineal (creciente con `intento`, tope 5s) y repite
     * con esa nueva tanda.
     *
     * @param intento - Número de vuelta actual; uso interno para calcular el backoff.
     */
    private async ejecutar(intento: number = 1): Promise<boolean> {
        if (this.operaciones.length==0) {
            return true;
        }

        if (intento>1) {
            await PromiseDelayed(Math.min(intento * 250, 5000));
        }

        const oks = await Promise.all(arrayChop(this.operaciones.splice(0), this.config.blockSize).map(bloque=>this.ejecutarBloque(bloque)));
        const ok = oks.every(ok=>ok);

        return await this.ejecutar(intento + 1) && ok;
    }

    /**
     * Envía un bloque en una única petición bulk. Si la petición entera falla (excepción, no
     * error por item), reintenta sobre el mismo bloque hasta 8 veces, esperando un backoff lineal
     * (creciente con el número de intento) entre cada una; si sigue fallando tras la última,
     * rechaza todas sus operaciones. Los items con error 429 no se reintentan aquí: se reencolan
     * en `operaciones` para que {@link ejecutar} los reintente en una tanda posterior.
     */
    private async ejecutarBloque(operaciones: BulkOperation[]): Promise<boolean> {
        const maxReintentos = 8;
        let reintentos = maxReintentos;

        let lastError: Error | undefined;
        while(reintentos > 0) {
            try {
                const data = await this.elastic.bulk({
                    index: this.config.index,
                    operations: operaciones.flatMap(op => op.operations),
                    refresh: this.config.refresh ?? false,
                })

                if (!data.errors) {
                    this.correctos += operaciones.length;
                    for (const op of operaciones) {
                        op.resolve();
                    }
                    return true;
                }

                let ok = true;
                const reportados: string[] = [];
                for (let i = 0, len = operaciones.length; i < len; i++) {
                    const op = operaciones[i];
                    const obj = data.items[i];
                    if (obj === null) {
                        console.log("Tenemos un item a NULL", i, len, operaciones.length, data.items.length);
                        continue;
                    }
                    const item = obj.index ?? obj.create ?? obj.update ?? obj.delete!;

                    if (item.error !== undefined) {
                        if (item.status === 429) {
                            this.operaciones.push(op);
                        } else {
                            if (!reportados.includes(item.error.type)) {
                                reportados.push(item.error.type);
                                error("Error irrecuperable de Bulk", JSON.stringify(item.error), JSON.stringify(op.operations));
                            }
                            this.erroneos++;
                            ok = false;
                            op.reject(item.error);
                        }
                    } else {
                        this.correctos++;
                        op.resolve();
                    }
                }

                return ok;
            } catch (err) {
                if (err instanceof Error) {
                    lastError = err;
                    const size = operaciones.reduce((acc, op) => acc + op.size, 0);
                    console.log(`Ha fallado bulk de ${operaciones.length} operaciones (${size} bytes): ${err.message}`);
                }
                reintentos--;
                if (reintentos>0) {
                    await PromiseDelayed(Math.min((maxReintentos - reintentos) * 250, 5000));
                }
            }
        }
        error("Error en petición Bulk", lastError?.message);
        return Promise.reject(lastError);
    }
}
