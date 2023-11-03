import {EngineBase} from "services-comun/modules/engine_base";

import {Configuracion} from "./utiles/config";
import {Repesca} from "./data/source/repesca";

export class Engine extends EngineBase<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        await Repesca.run();

        await super.ejecutar();
    }
}
