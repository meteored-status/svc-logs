/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: cf7bf494c774944c74e4ee4760d7b41a
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import chokidar from "chokidar";

import {Colors} from "@mr/core-cli/colors";

import {isFile, readJSON} from "@mr/core-cli/fs";
import {Idiomas, type TIdiomas} from ".";

export class IdiomasLoader extends Idiomas {
    /* STATIC */
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
