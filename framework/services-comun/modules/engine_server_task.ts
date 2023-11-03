import {error, info} from "./utiles/log";

import {ConfiguracionNet} from "./net/config/config";
import {EngineServer} from "./engine_server";

abstract class EngineServerTask<T extends ConfiguracionNet=ConfiguracionNet> extends EngineServer<T> {
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

export {EngineServerTask};
