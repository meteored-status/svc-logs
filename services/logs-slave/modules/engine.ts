import {ICacheBuilder} from "services-comun/modules/database/mysql/cache";
import {EngineServer} from "services-comun/modules/engine_server";
import elasticsearch from "services-comun/modules/utiles/elastic";
import db from "services-comun/modules/utiles/mysql";
import disk from "services-comun/modules/database/mysql/cache/disk";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import type {Configuracion} from "./utiles/config";

import Slave from "./net/handlers/slave";

export class Engine extends EngineServer<Configuracion> {
    /* STATIC */

    /* INSTANCE */
    public override async ejecutar(): Promise<void> {
        this.initWebServer([
            Slave(this.configuracion),
        ], this.configuracion.net);

        const builder = disk.config({cleanup: true});
        for (let i=0; i<100; i++){
            await this.test(builder);
            await PromiseDelayed(Math.random() * 100);
        }

        await super.ejecutar();
    }

    private async test(builder: ICacheBuilder) {
        const id = Math.floor(Math.random()*29)+1;
        const data = await db.select("SELECT * FROM hosts WHERE id=?", [id], {
            cache: {
                builder,
                ttl: 1500,
                key: id,
            },
        });
    }

    protected override async ok(): Promise<void> {
        await elasticsearch.info();
    }
}
