/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 48ace921c0b4032dfaf9f7721f49921a
 */

import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import {type IModuloConfig, Modulo as ModuloBase} from "../mrpack/modulo";
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
