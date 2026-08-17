/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: 3c134abb8351f1296976302ed446d7f5
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {Bulk} from ".";
import {PromiseDelayed} from "../../utiles/promise";
import {BulkBase, type BulkConfig} from "./base";
import type {Elasticsearch} from "..";
import {error} from "../../utiles/log";

/** @property interval - Cada cuántos ms se envían las operaciones acumuladas (por defecto 1000). */
export interface BulkAutoConfig extends BulkConfig {
    interval?: number;
}

/**
 * Como {@link "./index.ts".Bulk}, pero en vez de un envío puntual bajo demanda, envía las
 * operaciones acumuladas automáticamente cada `interval` ms (ver {@link start}) mientras esté en
 * marcha. Cada tanda se envía con una instancia de `Bulk` de un solo uso (ver {@link sendEjecutar}).
 */
export class BulkAuto extends BulkBase {
    /* STATIC */

    /* INSTANCE */
    private readonly interval: number;
    private sending: boolean;
    private timer?: NodeJS.Timeout;
    private timeout?: NodeJS.Timeout;
    public get length(): number { return this.operaciones.length; }

    public constructor(elastic: Elasticsearch, {interval=1000, ...config}: BulkAutoConfig = {}) {
        super(elastic, config);
        this.interval = interval;
        this.sending = false;
    }

    /** Detiene el envío automático y espera a que se termine de enviar todo lo pendiente (incluido lo que haya en vuelo). */
    public async wait(): Promise<void> {
        this.stop();

        while(this.length>0 || this.sending) {
            await PromiseDelayed(this.interval);
        }
    }

    /** Arranca (si no hay uno ya en marcha) el envío periódico cada `interval` ms. */
    public start(): void {
        if (this.timer!==undefined) {
            return;
        }

        if (this.timeout!==undefined) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        this.timer = setInterval(()=>{
            this.send();
        }, this.interval);
    }

    /**
     * Detiene el envío periódico y, si queda algo pendiente en la cola, programa un envío final
     * (inmediato, con un segundo intento de respaldo a los `interval` ms) para no dejarlo sin
     * enviar. Hace ese envío final aunque el temporizador no estuviera en marcha (p.ej. si nunca
     * se llamó a {@link start}), para que {@link wait} pueda confiar en que, tras llamar a
     * `stop`, cualquier operación pendiente termina enviándose.
     */
    public stop(): void {
        if (this.timer!==undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }

        if (this.operaciones.length>0) {
            setImmediate(()=>{
                this.send();
            });
            this.timeout = setTimeout(()=>{
                this.send();
                this.timeout = undefined;
            }, this.interval);
        }
    }

    /**
     * Dispara un envío si no hay uno ya en curso; si lo hay pero viene del temporizador de
     * respaldo de {@link stop} (`this.timeout` definido), se deja pasar igualmente — es un no-op
     * seguro porque {@link sendEjecutar} solo envía lo que quede en cola en ese momento.
     */
    private send(): void {
        if (this.sending && this.timeout===undefined) {
            return;
        }

        this.sending = true;
        this.sendEjecutar().then(()=>{
            this.sending = false;
        });
    }

    /** Envía de una vez todo lo acumulado hasta ahora mediante un {@link Bulk} de un solo uso. */
    private async sendEjecutar(): Promise<void> {
        if (this.operaciones.length===0) {
            return;
        }

        const bulk = Bulk.init(this.elastic, this.config);
        bulk.add(...this.operaciones.splice(0));
        try {
            await bulk.run();
        } catch (err) {
            error("Error al enviar el bulk", err);
        }
    }
}
