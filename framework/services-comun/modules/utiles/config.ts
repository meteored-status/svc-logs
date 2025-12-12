import {exists, readJSON} from "./fs";
import {crearPodInfo, type IPodInfo} from "./pod";

export {type IPodInfo};

export interface IConfigGenerico {}
export class ConfigGenerico<T extends IConfigGenerico=IConfigGenerico> implements IConfigGenerico {
    protected defecto: T;
    protected user: Partial<T>;

    public constructor(defecto: T, user: Partial<T>) {
        this.defecto  = defecto;
        this.user = user;
    }
}

interface IGoogleStorage<T extends IConfigGenerico=IConfigGenerico> {
    credenciales: string;
    buckets?: T;
    package?: string;
    subdir?: string;
    subdir2?: string;
}
class GoogleStorage<T extends ConfigGenerico> implements IGoogleStorage {
    public readonly credenciales: string;
    public readonly buckets: T;
    public readonly package?: string;
    public readonly subdir?: string;
    public readonly subdir2?: string;

    public constructor(defecto: IGoogleStorage, user: Partial<IGoogleStorage>, buckets?: T) {
        this.credenciales = user.credenciales??defecto.credenciales;
        this.buckets = buckets??new ConfigGenerico({}, {}) as T;
        this.package = user.package??defecto.package;
        this.subdir = user.subdir??defecto.subdir;
        this.subdir2 = user.subdir2??defecto.subdir2;
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

export interface IConfiguracion extends IConfigGenerico {
    pod?: IPodInfo;
}
export class Configuracion<T extends IConfiguracion=IConfiguracion> extends ConfigGenerico<T> implements IConfiguracion {
    /* STATIC */
    protected static async cargar<S extends IConfiguracion>(defecto: S): Promise<Configuracion<S>> {
        const [pod, cfg] = await Promise.all([
            crearPodInfo(),
            exists("files/config.json").then(
                existe=>existe?
                    readJSON<Partial<S>>("files/config.json"):
                    {}
            ),
        ]);
        return new this<S>({
            ...defecto,
            pod,
        }, cfg) as Configuracion<S>;
    }

    /* INSTANCE */
    public readonly pod: IPodInfo;

    public constructor(defecto: T, user: Partial<T>) {
        super(defecto, user);

        this.pod = defecto.pod!;
    }
}

export interface IConfiguracionLoader {
    load: ()=>Promise<Configuracion>;
}
