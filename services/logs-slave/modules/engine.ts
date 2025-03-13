import {ClienteGCS} from "logs-base/modules/data/cliente/gcs";
import {EngineServer} from "services-comun/modules/engine_server";

import type {Configuracion} from "./utiles/config";

import Slave from "./net/handlers/slave";

export class Engine extends EngineServer<Configuracion> {
    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        await ClienteGCS.check();

        this.initWebServer([
            Slave(this.configuracion),
        ], this.configuracion.net);

        await super.ejecutar();
    }

    // protected override async ok(): Promise<void> {
    //     await elasticsearch.info();
    // }
}
