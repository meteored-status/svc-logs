import crypto from "node:crypto";
import os from "node:os";

import {exists, readJSON} from "./fs";
import {random} from "./random";

export interface IConfigGenerico {}
export class ConfigGenerico<T extends IConfigGenerico=IConfigGenerico> implements IConfigGenerico {
    public constructor(protected defecto: T, protected user: Partial<T>) {

    }
}

interface IGoogleStorage<T extends IConfigGenerico=IConfigGenerico> {
    credenciales: string;
    buckets: T;
}
class GoogleStorage<T extends ConfigGenerico> implements IGoogleStorage {
    public readonly credenciales: string;
    public readonly buckets: T;

    public constructor(defecto: IGoogleStorage, user: Partial<IGoogleStorage>, buckets?: T) {
        this.credenciales = user.credenciales??defecto.credenciales;
        this.buckets = buckets??new ConfigGenerico({}, {}) as T;
    }
}

export interface IGoogle<T extends IConfigGenerico=IConfigGenerico> {
    id?: string;
    cliente?: string;
    location?: string;
    storage: IGoogleStorage<T>;
}
export class Google<T extends ConfigGenerico=ConfigGenerico> implements IGoogle {
    public readonly id: string;
    public readonly cliente: string;
    public readonly location: string;
    public readonly storage: GoogleStorage<T>;

    public constructor(defecto: IGoogle, user: Partial<IGoogle>, buckets?: T) {
        this.id = (user.id??defecto.id)??"";
        this.cliente = (user.cliente??defecto.cliente)??"";
        this.location = (user.location??defecto.location)??"";
        this.storage = new GoogleStorage<T>(defecto.storage??{
            credenciales: "",
            buckets: {},
        }, user.storage??{}, buckets);
    }
}

type StringOne = [string, ...string[]];

export interface IPodInfo {
    filesdir: string;
    version: string;
    hash: string;
    host: string;
    servicio: string;
    servicios: StringOne;
    zona: string;
    cronjob: boolean;
    replica: string;
    wire: number;
    deploy: string;
}

export interface IConfiguracion {}
export class Configuracion<T extends IConfiguracion=IConfiguracion> implements IConfiguracion {
    /* STATIC */
    protected static async cargar<S extends IConfiguracion>(defecto: S): Promise<Configuracion<S>> {
        const [data, cfg] = await Promise.all([
            readJSON("package.json"),
            exists("files/config.json").then(async (existe)=>{
                if (existe) {
                    return readJSON<Partial<S>>("files/config.json");
                }
                return {};
            }),
        ]);
        return new this<S>(defecto, cfg, data.servicio??"unknown", data.version??`0000.00.00-000`, data.config.cronjob??false);
    }

    /* INSTANCE */
    public readonly pod: Readonly<IPodInfo>;

    protected constructor(protected defecto: T, protected readonly user: Partial<T>, svc: string|string[], version: string, cronjob: boolean) {
        const servicios = (!Array.isArray(svc)?[svc]:(svc.length>0?svc:["unknown"])) as StringOne;
        const host = PRODUCCION?os.hostname():servicios[0];

        const partes = host.split("-");
        let replica: string;
        let wire: number;
        let deploy: string;
        if (PRODUCCION) {
            replica = partes.at(-1) ?? "test";
            if (!cronjob) {
                wire = 0;
                deploy = partes.at(-2) ?? "test";
            } else {
                const tmp_wire = partes.at(-2);
                if (tmp_wire!=undefined) {
                    if (!isNaN(parseFloat(tmp_wire)) && isFinite(tmp_wire as any)) {
                        wire = parseInt(tmp_wire);
                        deploy = partes.at(-3) ?? "test";
                    } else {
                        wire = 0;
                        deploy = tmp_wire;
                    }
                } else {
                    wire = 0;
                    deploy = "test";
                }
            }
        } else {
            replica = random(5).toLowerCase();
            wire = 0;
            deploy = random(10).toLowerCase();
        }

        const servicio = servicios.find(svc=>host.includes(svc))??servicios[0];

        this.pod = Object.seal({
            filesdir: 'files',
            version,
            hash: crypto.createHash('md5').update(version).digest("hex"),
            host,
            servicio,
            servicios,
            zona: process.env["ZONA"]??"desarrollo",
            cronjob,
            replica,
            wire,
            deploy,
        });
    }
}

export interface IConfiguracionLoader {
    load: ()=>Promise<Configuracion>;
}
