import chokidar from "chokidar";

import {Fecha} from "services-comun/modules/utiles/fecha";
import {isDir, isFile, mkdir, readDir, readJSON, safeWrite, unlink} from "services-comun/modules/utiles/fs";

import {Colors} from "../../../mrpack/clases/colors";
import type {Idiomas, TIdiomas} from "../idioma";
import {type IModuloConfig as IModuloConfigBase, type IPackageConfig, Modulo} from ".";
import {ModuloMySQL} from "./mysql";
import type {Traduccion} from "./traduccion/loader";
import {TraduccionLoaderJSON} from "./traduccion/loader/json";
import {TraduccionLoaderMySQL} from "./traduccion/loader/mysql";
import claseTMPL from "./tmpl/clase";
import db from "../../mysql";
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
    borrar: boolean;
    padre?: ModuloJSON;
    config: IPackageConfig;
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

        let row: IModuloJSON;
        let config: IModuloConfig;
        if (await isFile(`${dir}/_metadata.json`)) {
            row = {
                ...await readJSON<Partial<IModuloJSON>>(`${dir}/_metadata.json`),
                id: padre!=undefined?`${padre.id}.${id}`:id,
            };
            config = {
                jsondir,
                nuevo: false,
                borrar: false,
                padre,
                config: paquete,
            };
        } else {
            row = {
                id: padre!=undefined?`${padre.id}.${id}`:id,
            };
            config = {
                jsondir,
                nuevo: false,
                borrar: true,
                padre,
                config: paquete,
            };
        }

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

    public async preparePush(): Promise<void> {
        const mysql = await ModuloMySQL.load(this.id, this.config.config, this.idiomas).catch(()=>undefined);
        if (mysql==undefined) {
            this.config.nuevo = true;
        } else {
            if (mysql.hash!=this.hash) {
                console.error(`El modulo ${Colors.colorize([Colors.FgYellow], this.id)} tiene una versión más reciente en mysql`)
                return Promise.reject();
            }
        }
        for (const submodulo of this.submodulos as ModuloJSON[]) {
            await submodulo.preparePush();
        }
        await this.refreshHash();
    }

    private quitarSubmodulo(submodulo: ModuloJSON): void {
        const i = this.submodulos.indexOf(submodulo);
        if (i>=0) {
            this.submodulos.splice(i, 1);
        }
    }

    private async borrar(): Promise<void> {
        for (const submodulo of this.submodulos as ModuloJSON[]) {
            await submodulo.borrar();
        }
        await db.update("UPDATE `modulos` SET `borrado`=1 WHERE `id`=?", [this.id]);
        await unlink(`${this.config.jsondir}/${this.jerarquia.join("/")}`);
        this.config.padre?.quitarSubmodulo(this);
    }

    public async toMySQL(): Promise<void> {
        const idiomas = this.customIdiomas==undefined ? null : JSON.stringify(this.customIdiomas);
        if (this.config.borrar) {
            console.log(`Borrando el módulo ${Colors.colorize([Colors.FgRed], this.id)}`);
            await this.borrar();
            return;
        }

        if (!this.cambio) {
            console.log(`Ignorando el módulo ${Colors.colorize([Colors.FgYellow], this.id)}`);
            return;
        }

        if (this.config.nuevo) {
            console.log(`Insertando el módulo ${Colors.colorize([Colors.FgGreen], this.id)}`);
            await db.insert("INSERT INTO `modulos` (`id`, `padre`, `descripcion`, `idiomas`, `version`, `hash`) VALUES (?, ?, ?, ?, ?, ?)", [this.id, this.config.padre?.id??null, this.descripcion, idiomas, this.version, this.hash]);
            this.config.nuevo = false;
        } else {
            console.log(`Actualizando el módulo ${Colors.colorize([Colors.FgGreen], this.id)}`);
            await db.update("UPDATE `modulos` SET `descripcion`=?, `idiomas`=?, `version`=?, `hash`=? WHERE `id`=?", [this.descripcion, idiomas, this.version, this.hash, this.id]);

            const values = Object.keys(this.values);
            if (values.length>0) {
                await db.update("UPDATE `traducciones` SET `borrado`=1 WHERE `modulo`=? AND `borrado`=0 AND `id` NOT IN (?)", [this.id, values]);
            }
            if (this.submodulos.length>0) {
                await db.update("UPDATE `modulos` SET `borrado`=1 WHERE `padre`=? AND `borrado`=0 AND `id` NOT IN (?)", [this.id, this.submodulos.map((modulo) => modulo.id)]);
            }
        }
        this.cambio = false;


        for (const value of Object.values(this.values)) {
            if (value!=undefined) {
                if (!await TraduccionLoaderMySQL.existe(this, value.id)) {
                    value.nuevo = true;
                }
                await value.guardar();
            }
        }


        for(const submodulo of this.submodulos as ModuloJSON[]) {
            await submodulo.toMySQL();
        }
        await this.write(`${this.config.jsondir}/${this.jerarquia.join("/")}`);
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
        await mkdir(interfaceDir, true);
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
            version: Fecha.generarVersion(this.version),
            hash: this.hash,
            className: this.className,
            valores,
            submodulos,
        });
        const promesas: Promise<void|boolean>[] = [];
        for (const lang of [...idiomas]) {
            const dir = `${classdir}/.src/${lang.replace("-", "")}/${this.jerarquia.join("/").replaceAll("-", "_")}`;
            await mkdir(dir, true);

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
