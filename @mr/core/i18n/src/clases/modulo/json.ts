/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: a71e5f2ad34e542c53427e341cd04f75
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import chokidar from "chokidar";


import {isDir, isFile, mkdir, readDir, readJSON, safeWrite} from "@mr/core-cli/fs";
import type {Idiomas, TIdiomas} from "../idioma";
import {type IModuloConfig as IModuloConfigBase, type IPackageConfig, Modulo} from ".";
import type {Traduccion} from "./traduccion/loader";
import {TraduccionLoaderJSON} from "./traduccion/loader/json";
import claseTMPL from "./tmpl/clase";
import interfaceTMPL from "./tmpl/interface";
import interfaceBundleTMPL from "./tmpl/interface-bundle";

export interface IModuloJSON {
    id: string;
    descripcion?: string;
    idiomas?: TIdiomas;
    version?: string;
    hash?: string;
}

interface IModuloConfig extends IModuloConfigBase {
    jsondir: string;
    padre?: ModuloJSON;
    config: IPackageConfig;
}

/**
 * La versión de un módulo a partir de su fecha, en UTC: `2026.9.4-153012`.
 *
 * Copia local de `Fecha.generarVersion()` (`services-comun/modules/utiles/fecha`), la única de
 * las decenas de funciones de aquel módulo que usaba este paquete. Traerla es lo que deja a
 * `@mr/core-i18n` sin dependencia a `services-comun`.
 */
function generarVersion(date: Date): string {
    const dosDigitos = (n: number): string => `00${n}`.slice(-2);

    return `${date.getUTCFullYear()}.${date.getUTCMonth()+1}.${date.getUTCDate()}-${date.getUTCHours()}${dosDigitos(date.getUTCMinutes())}${dosDigitos(date.getUTCSeconds())}`;
}

export class ModuloJSON extends Modulo<IModuloConfig> {
    /* STATIC */
    public static async load(jsondir: string, id: string, idiomas: Idiomas, paquete: IPackageConfig, padre?: ModuloJSON): Promise<ModuloJSON> {
        const dir = padre!=undefined?
            `${jsondir}/${padre.jerarquia.join("/")}/${id}`:
            `${jsondir}/${id}`;
        if (!await isDir(dir)) {
            return Promise.reject(`No existe el modulo ${id}`);
        }

        // Sin `_metadata.json` el módulo se queda con lo mínimo. Las dos ramas construían además
        // configs distintas —`borrar: true` en esta— y ya no: ese flag solo lo leía `toMySQL()`,
        // para marcar el módulo como borrado en la base de datos. Sin MySQL no hay nada que borrar.
        const row: IModuloJSON = await isFile(`${dir}/_metadata.json`) ?
            {
                ...await readJSON<Partial<IModuloJSON>>(`${dir}/_metadata.json`),
                id: padre!=undefined?`${padre.id}.${id}`:id,
            } :
            {
                id: padre!=undefined?`${padre.id}.${id}`:id,
            };

        const config: IModuloConfig = {
            jsondir,
            padre,
            config: paquete,
        };

        return this.build(row, idiomas, config);
    }

    protected static async loadPadre(jsondir: string, padre: ModuloJSON, idiomas: Idiomas, paquete: IPackageConfig): Promise<ModuloJSON[]> {
        const dir = `${jsondir}/${padre.jerarquia.join("/")}`;
        if (!await isDir(dir)) {
            return Promise.reject(`No existe el modulo ${padre.jerarquia.join("/")}`);
        }
        const files = await readDir(dir);
        const hijos: string[] = [];
        for (const file of files) {
            if (await isDir(`${dir}/${file}`)) {
                hijos.push(file);
            }
        }

        return await Promise.all(hijos.map(hijo=>this.load(jsondir, hijo, idiomas, paquete, padre)));
    }

    protected static async build(row: IModuloJSON, idiomas: Idiomas, config: IModuloConfig): Promise<ModuloJSON> {
        const modulo = new this({
            id: row.id,
            padre: config.padre?.id,
            descripcion: row.descripcion??"",
            idiomas: row.idiomas,
            version: new Date(row.version??0),
            hash: row.hash??"",
        }, idiomas, config);
        await modulo.load();

        return modulo;
    }

    /* INSTANCE */
    protected async loadValues(): Promise<Record<string, Traduccion|undefined>> {
        return TraduccionLoaderJSON.loadAll(this, this.config.jsondir);
    }

    protected async loadSubmodulos(): Promise<Modulo[]> {
        return ModuloJSON.loadPadre(this.config.jsondir, this, this.idiomas, this.config.config);
    }

    public get submodulosFinales(): ModuloJSON[] {
        const include = this.config.config.modulos[this.id]?.include ?? [...this.submodulos.map(modulo=>modulo.base_id), ...Object.keys(this.values)];
        const exclude = this.config.config.modulos[this.id]?.exclude ?? [];

        const submodulos: ModuloJSON[] = [];
        for (const submodulo of this.submodulos) {
            if (exclude.includes(submodulo.base_id)) {
                continue;
            }
            if (!include.includes(submodulo.base_id)) {
                continue;
            }
            submodulos.push(submodulo as ModuloJSON);
        }

        return submodulos;
    }

    public get valoresFinales(): Traduccion[] {
        const include = this.config.config.modulos[this.id]?.include ?? [...this.submodulos.map(modulo=>modulo.base_id), ...Object.keys(this.values)];
        const exclude = this.config.config.modulos[this.id]?.exclude ?? [];

        const valores: Traduccion[] = [];
        for (const key of Object.keys(this.values)) {
            if (exclude.includes(key)) {
                continue;
            }
            if (!include.includes(key)) {
                continue;
            }
            valores.push(this.values[key]!);
        }

        return valores;
    }

    public async regenerar(classdir: string, idiomas: string[] = []): Promise<Record<string, string[]>> {
        const submodulos = this.submodulosFinales;
        const valores = this.valoresFinales;

        const interfaceDir = `${classdir}/${this.id.replaceAll("-", "_").replaceAll(".", "/")}`;
        await mkdir(interfaceDir);
        const langs: Record<string, string[]> = {};
        const mapping: Record<string, string> = {};
        for (const lang of this.config.config.langs) {
            const seleccionado = this.calcularLang(lang, submodulos, valores);
            langs[seleccionado] ??= [];
            langs[seleccionado].push(lang);
            if (lang!=seleccionado) {
                mapping[lang] = seleccionado;
            }
        }
        const promesas: Promise<void|boolean>[] = [];
        for (const lang of Object.keys(langs)) {
            promesas.push(this.regenerarEjecutar(classdir, lang, submodulos, valores, idiomas));
        }
        promesas.push(
            safeWrite(`${interfaceDir}/index.ts`, interfaceTMPL({id: this.id, jerarquia: this.jerarquia, className: this.className, valores, submodulos, lang: this.config.config.lang, mapping}), true),
            safeWrite(`${interfaceDir}/bundle.ts`, interfaceBundleTMPL({id: this.id, jerarquia: this.jerarquia, className: this.className, langs: this.config.config.langs, lang: this.config.config.lang, mapping}), true),
        );

        for (const lang of Object.keys(langs)) {
            if (!idiomas.includes(lang)) {
                idiomas.push(lang);
            }
        }
        idiomas.sort();
        for (const modulo of submodulos) {
            promesas.push(modulo.regenerar(classdir, idiomas).then(()=>{}));
        }
        await Promise.all(promesas);

        return langs;
    }

    private getJerarquiaIdiomas(lang: string): string[] {
        const idiomas = this.customIdiomas??this.idiomas;
        const idiomasJerarquia: string[] = [lang];
        // console.log("ca-ES", idiomas.getFallbacks("ca-ES"));
        if (lang.length>2) {
            idiomasJerarquia.push(...new Set([...idiomas.getFallbacksDOWN(lang)]));
        } else {
            idiomasJerarquia.push(...new Set([...idiomas.getFallbacksUP(lang), ...idiomas.getFallbacksDOWN(lang)]));
        }

        return idiomasJerarquia;
    }

    private calcularLang(lang: string, submodulos: ModuloJSON[]=this.submodulosFinales, valores: Traduccion[]=this.valoresFinales): string {
        const langs: string[] = [];
        for (const valor of valores) {
            const idioma = valor.getIdioma(this.getJerarquiaIdiomas(lang));
            if (idioma!=undefined && !langs.includes(idioma)) {
                langs.push(idioma);
            }
        }
        for (const valor of submodulos) {
            const idioma = valor.calcularLang(lang);
            if (!langs.includes(idioma)) {
                langs.push(idioma);
            }
        }

        switch(langs.length) {
            case 0:
                return "_";
            case 1:
                return langs[0];
            default:
                return lang;
        }
    }

    private async regenerarEjecutar(classdir: string, lang: string, submodulos: ModuloJSON[], valores: Traduccion[], idiomas: string[]): Promise<void> {
        if (!idiomas.includes(lang)) {
            idiomas.push(lang);
        }

        const contenido = claseTMPL({
            id: this.id,
            jerarquia: this.jerarquia,
            version: generarVersion(this.version),
            hash: this.hash,
            className: this.className,
            valores,
            submodulos,
        });
        const promesas: Promise<void|boolean>[] = [];
        for (const lang of [...idiomas]) {
            const dir = `${classdir}/.src/${lang.replace("-", "")}/${this.jerarquia.join("/").replaceAll("-", "_")}`;
            await mkdir(dir);

            promesas.push(safeWrite(`${dir}/index.ts`, contenido, true));
            const jerarquia = this.getJerarquiaIdiomas(lang);
            for (const value of valores) {
                promesas.push(value.write(dir, jerarquia));
            }
        }
        await Promise.all(promesas);
        for (const value of valores) {
            value.clean();
        }
    }

    public addWatch(classdir: string): void {
        const dir = `${this.config.jsondir}/${this.jerarquia.join("/")}`;
        chokidar.watch(`${dir}/_metadata.json`, {
            persistent: true,
        }).on("change", ()=>{
            console.log("Cambios en ", `${dir}/_metadata.json`);
            this.regenerar(classdir).then(()=>{}).catch(()=>{});
        });
        chokidar.watch(`${dir}/_values.json`, {
            persistent: true,
        }).on("change", ()=>{
            console.log("Cambios en ", `${dir}/_values.json`);
            this.regenerar(classdir).then(() => {}).catch(() => {});
        });
        for (const modulo of this.submodulos as ModuloJSON[]) {
            modulo.addWatch(classdir);
        }
    }
}
