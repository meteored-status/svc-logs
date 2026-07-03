import {Engine as EngineServer} from "@mr/core-workload/engine/server";

import type {Configuracion} from "./utiles/config";

import Slave from "./net/handlers/slave";

export class Engine extends EngineServer<Configuracion> {
    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
            Slave(this.configuracion),
        ], this.configuracion.net);

        await super.ejecutar();
    }
}
