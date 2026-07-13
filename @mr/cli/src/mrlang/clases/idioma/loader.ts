/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 424e73314c46ccee629c123f38016a2e
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import chokidar from "chokidar";

import {Colors} from "services-comun/modules/utiles/colors";

import {isFile, readJSON} from "../../../utiles/fs";
import {Idiomas, type TIdiomas} from ".";
import db from "../../mysql";

interface IIdiomaMySQL {
    idioma: string;
    fallbacks: string[];
    version: Date;
}

export class IdiomasLoader extends Idiomas {
    /* STATIC */
    public static async fromMySQL(): Promise<Idiomas> {
        const fallbacks: TIdiomas = {};
        let fecha = new Date(0);
        for (const idioma of await db.select<IIdiomaMySQL>("SELECT * FROM `idiomas` ORDER BY `idioma`")) {
            fallbacks[idioma.idioma] = idioma.fallbacks;
            fecha = fecha<idioma.version ? idioma.version : fecha;
        }

        return new this(fallbacks, fecha);
    }

    public static fromJSON(data: TIdiomas, version?: Date): IdiomasLoader {
        return new this(data, version??new Date(0));
    }

    /* INSTANCE */
    private constructor(fallbacks: TIdiomas, public readonly version: Date) {
        super(fallbacks);
    }

    private async reload(basedir: string): Promise<void> {
        if (!await isFile(`${basedir}/idiomas.json`)) {
            console.error("No existe el archivo", Colors.colorize([Colors.FgRed], "idiomas.json"));
            return;
        }
        this.init(await readJSON<TIdiomas>(`${basedir}/idiomas.json`));
    }

    public addWatch(basedir: string): void {
        chokidar.watch(`${basedir}/idiomas.json`, {
            persistent: true,
        }).on("change", ()=>{
            console.log("Cambios en ", `${basedir}/idiomas.json`);
            this.reload(basedir).then(()=>{}).catch(()=>{});
        });
    }
}
