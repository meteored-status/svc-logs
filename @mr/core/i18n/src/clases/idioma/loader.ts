/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 044a150374264ae779bb98372b60afb5
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
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
