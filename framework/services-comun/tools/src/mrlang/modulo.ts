import {IModuloConfig, Modulo as ModuloBase} from "services-comun/tools/src/mrpack/modulo";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import db from "./mysql";

export abstract class Modulo<T extends IModuloConfig> extends ModuloBase<T> {
    /* STATIC */
    public static override run<T extends IModuloConfig>(modulo: Modulo<T>): void {
        PromiseDelayed()
            .then(async ()=>modulo.run())
            .catch(async (err)=>{
                if (err!=undefined) {
                    console.error(err)
                }
            })
            .then(async ()=>{
                await db.close();
            })
            .catch(err=>{
                console.error(err);
            });
    }

    /* INSTANCE */
}
