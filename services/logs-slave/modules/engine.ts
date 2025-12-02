import {EngineServer} from "services-comun/modules/engine_server";

import type {Configuracion} from "./utiles/config";

import Slave from "./net/handlers/slave";
import {readDir} from "services-comun/modules/utiles/fs";

export class Engine extends EngineServer<Configuracion> {
    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
            Slave(this.configuracion),
        ], this.configuracion.net);

        console.log(await readDir("files/credenciales/"));

        await super.ejecutar();
    }
}
