/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: e90a0e55a8838609b504d77e7dddf35b
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {monitorEventLoopDelay} from "node:perf_hooks";

import type {IHeartbeatMetricas} from "./interface";

/** Resolución (ms) del muestreo del retraso del event loop. */
const RESOLUCION_LOOP_MS = 20;

/** Nanosegundos por milisegundo. */
const NS_POR_MS = 1e6;

/**
 * Mide el proceso para el heartbeat: RSS, retraso del event loop y uptime.
 *
 * El histograma del event loop se reinicia en cada lectura, así que `loopP99` y `loopMax` son los del
 * periodo desde el envío anterior.
 */
export class MedidorMetricas {
    private readonly histograma: ReturnType<typeof monitorEventLoopDelay>;

    public constructor() {
        this.histograma = monitorEventLoopDelay({resolution: RESOLUCION_LOOP_MS});
        this.histograma.enable();
    }

    /**
     * Lee las métricas y reinicia el histograma.
     */
    public leer(): IHeartbeatMetricas {
        const metricas: IHeartbeatMetricas = {
            rss: process.memoryUsage.rss(),
            loopP99: Math.round(this.histograma.percentile(99) / NS_POR_MS * 10) / 10,
            loopMax: Math.round(this.histograma.max / NS_POR_MS * 10) / 10,
            uptime: Math.round(process.uptime()),
        };
        this.histograma.reset();

        return metricas;
    }

    public detener(): void {
        this.histograma.disable();
    }
}
