import {EngineServer} from "services-comun/modules/engine_server";
import elasticsearch from "services-comun/modules/elasticsearch/elastic";

import type {Configuracion} from "./utiles/config";

import Slave from "./net/handlers/slave";

export class Engine extends EngineServer<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
            Slave(this.configuracion, this.abortSignal),
        ], this.configuracion.net);

        await super.ejecutar();
    }

    protected override async ok(): Promise<void> {
        await elasticsearch.info();
    }
}
