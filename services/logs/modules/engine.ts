import {EngineServer} from "services-comun/modules/engine_server";
import elasticsearch from "services-comun/modules/utiles/elastic";

import type {Configuracion} from "./utiles/config";

import Error from "./net/handlers/error";
import Servicio from "./net/handlers/servicio";

export class Engine extends EngineServer<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
            Error(this.configuracion),
            Servicio(this.configuracion)
        ], this.configuracion.net);

        await super.ejecutar();
    }

    protected override async ok(): Promise<void> {
        await elasticsearch.info();
    }
}
