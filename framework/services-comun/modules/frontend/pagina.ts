import {ConfigCache} from "../cache/config";
import {IConfigPlantilla, IParametros, Plantilla, TDevice as TPaginaDevice} from "./plantilla";
import {IMetatags} from "./metatags";
import {IMiga} from "./miga";
import {TDevice} from "../net/conexion";

interface IParametroPaginaRecursosCSS {
    href: string;
    media?: string;
}

interface IParametrosPaginaRecursos {
    css: IParametroPaginaRecursosCSS[];
    critical?: string;
    js: string[];
}

interface IParametrosPaginaJsonLd {
    active: boolean;
    contenido: string;
}

export interface IParametrosPaginaBloques {
    cabecera: string;
    footer: string;
}

export interface IParametrosPagina<T extends IParametrosPaginaBloques=IParametrosPaginaBloques> extends IParametros {
    device: TPaginaDevice;
    dominio: string;
    seccion: string;
    classBody: string;
    tipologia?: string;
    subtipologia?: string;
    subdominio: string;
    metatags: IMetatags;
    recurso: IParametrosPaginaRecursos;
    bloque: T;
    miga:  IMiga[];
    contenido: NodeJS.Dict<any>;
    jsonld?: IParametrosPaginaJsonLd;
}

export interface IConfigPlantillaPagina extends IConfigPlantilla {
    dominio: string;
    url: string;
    device: TDevice;
    seccion: string;
    classBody: string;
}

export abstract class Pagina<T extends IConfigPlantillaPagina = IConfigPlantillaPagina> extends Plantilla<T> {
    /* STATIC */
    public static checkDevice(device: TDevice): TPaginaDevice {
        switch(device) {
            case TDevice.mobile:
                return TPaginaDevice.mv;
            default:
                return TPaginaDevice.pc;
        }
    }

    /* INSTANCE */
    protected readonly device: TPaginaDevice;

    protected constructor(cache: ConfigCache, config: T) {
        super(cache, config);

        this.device = Pagina.checkDevice(this.config.device);
    }
}
