/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: b7c129548fb3d6ceec406f69138947ef
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.6.17+5-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ConfiguracionNet} from "@mr/core-workload/config/net";
import {Engine as EngineServer} from "@mr/core-workload/engine/server";

import {error, info} from "./utiles/log";

export abstract class EngineServerTask<T extends ConfiguracionNet=ConfiguracionNet> extends EngineServer<T> {
    /* INSTANCE */
    private checking: boolean;

    protected constructor(configuracion: T, inicio: number) {
        super(configuracion, inicio);

        this.checking = false;
    }

    protected initCheckDatos(interval: number|null, solape: boolean=false): void {
        info("Configurando updater de salidas");

        const delay = this.checkDatosDelay();
        setTimeout(()=>{
            if (interval!=null) {
                setInterval(() => {
                    this.checkDatos(solape).then(async ()=>{}).catch(async ()=>{});
                }, interval);
            }

            this.checkDatos(solape).then(async ()=>{}).catch(async ()=>{});

        }, delay);
    }

    protected async checkDatos(solape: boolean=false): Promise<void> {
        if (!this.checking || solape) {
            this.checking = true;

            await this.checkDatosEjecutar().catch(async (err)=>{
                error("Error en EngineServerTask.checkDatos", err);
            });

            this.checking = false;
        }
    }

    protected abstract checkDatosDelay(): number;
    protected abstract checkDatosEjecutar(): Promise<void>;
}
