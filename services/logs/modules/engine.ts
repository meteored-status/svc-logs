import {EngineServer} from "services-comun/modules/engine_server";
import elasticsearch from "services-comun/modules/utiles/elastic";

import type {Configuracion} from "./utiles/config";

export class Engine extends EngineServer<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
        ], this.configuracion.net);

        await super.ejecutar();
    }

    protected override async ok(): Promise<void> {
        await elasticsearch.info();
    }
}
