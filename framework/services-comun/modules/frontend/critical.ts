import {watch} from "node:fs";

import {isFile, readFile, readJSON} from "../utiles/fs";
import {info} from "../utiles/log";
import {PromiseDelayed} from "../utiles/promise";

declare var PRODUCCION: boolean;

export class Critical {
    /* STATIC */
    private static CACHE: Map<string, string> = new Map<string, string>();
    private static MAPS: Map<string, Buffer> = new Map<string, Buffer>();

    public static async precache(): Promise<void> {
        await this.precacheEjecutar(true);
        if (!PRODUCCION) {
            let precacheando = false;
            watch("output/critical", () => {
                if (precacheando) {
                    return;
                }
                precacheando = true;
                PromiseDelayed(0).then(async ()=>{
                    await this.precacheEjecutar(false);
                    precacheando = false;
                }).catch(()=>{
                    precacheando = false;
                });
            });
        }
    }

    private static async precacheEjecutar(primero: boolean): Promise<void> {
        if (primero) {
            info("Precacheando CSS crítico");
        } else {
            info("Actualizando CSS crítico");
        }
        if (await isFile(`output/critical/stats.json`)) {
            const stats = await readJSON<Record<string, string[]>>(`output/critical/stats.json`);
            for (const key of Object.keys(stats)) {
                const nombre = key.replace(".js", "");
                for (const value of stats[key]) {
                    if (value.endsWith(".css")) {
                        const file = value.replace("/js/bundle/", "output/critical/");
                        if (await isFile(file)) {
                            const data = await readFile(file);
                            const str = data.toString("utf-8");
                            this.CACHE.set(nombre, str);
                            this.CACHE.set(`${nombre}.css`, str);
                            const map = `${file}.map`;
                            if (await isFile(map)) {
                                const data = await readFile(map);
                                this.MAPS.set(nombre, data);
                                this.MAPS.set(`${nombre}.css.map`, data);
                            }
                        }
                    }
                }
            }

        }
    }

    public static async get(css: string): Promise<string|undefined> {
        return this.CACHE.get(css);
    }

    public static async getMap(css: string): Promise<Buffer|undefined> {
        return this.MAPS.get(css);
    }
}
