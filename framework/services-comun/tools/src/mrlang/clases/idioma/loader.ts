import {watch} from "node:fs";
import {Colors} from "services-comun/modules/utiles/colors";
import {isFile, readJSON} from "services-comun/modules/utiles/fs";

import {Idiomas, type TIdiomas} from "./";
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
        for (const idioma of await db.query<IIdiomaMySQL>("SELECT * FROM `idiomas` ORDER BY `idioma`")) {
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
        watch(`${basedir}/idiomas.json`, async (_, filename)=>{
            console.log("Cambios en ", `${basedir}/idiomas.json`, filename);
            this.reload(basedir).then(()=>{}).catch(()=>{});
        });
    }
}
