/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:25:23 GMT
 * Hash: f7f62ad3d1c8e42364324c4fd481bc9a
 * Versión: 2026.6.17+5-josantoniojimnez
 * Anterior: 2026.6.17+3-josantoniojimnez
 */

import type {ConfiguracionNet} from "@mr/core-workload/config/net";
import {Engine as EngineServer} from "@mr/core-workload/engine/server";

import {error, info} from "./utiles/log";

export abstract class EngineServerTask<T extends ConfiguracionNet=ConfiguracionNet> extends EngineServer<T> {
    /* STATIC */

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
