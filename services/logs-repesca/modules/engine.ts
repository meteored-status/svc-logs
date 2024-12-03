import {Telemetry} from "logs-base/modules/data/telemetry";
import {EngineBase} from "services-comun/modules/engine_base";

import {Configuracion} from "./utiles/config";
import {Repesca} from "./data/repesca";

export class Engine extends EngineBase<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        await Repesca.run(this.configuracion);
        await Telemetry.stop();

        await super.ejecutar();
    }
}
