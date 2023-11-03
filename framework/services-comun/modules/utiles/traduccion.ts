import {Idioma} from "../net/idiomas";

export enum ETraduccion {
    literal = 'literal',
}

interface ITraduccion {
    modulo: string;
    nombre: string;
    tipo: ETraduccion;
    params?: string[];
}

export abstract class Traduccion<T extends NodeJS.Dict<string>> {
    /* STATIC */

    /* INSTANCE */
    protected readonly modulo: string;
    protected readonly nombre: string;
    protected readonly tipo: ETraduccion;
    protected readonly params: string[] = [];
    protected readonly paramsRegex: RegExp[] = [];
    protected readonly paramsLength;

    protected get module_name(): string {
        return `${this.modulo}.${this.nombre}`.toUpperCase();
    }

    protected constructor(objLang: ITraduccion) {
        this.modulo = objLang.modulo;
        this.nombre = objLang.nombre;
        this.tipo = objLang.tipo;
        this.params = objLang.params??[];
        this.paramsRegex = this.params.map(param => new RegExp(`\\{\\{${param}\\}\\}`, 'g'));
        this.paramsLength = this.params.length;
    }

    protected aplicarParams(salida: string, params?: Partial<T>): string {
        if (this.paramsLength > 0) {
            params ??= {};
            for (let i = 0; i < this.paramsLength; i++) {
                salida = salida.replace(this.paramsRegex[i], params[this.params[i]] ?? this.params[i].toUpperCase());
            }
        }
        return salida;
    }

    protected async render(salida: string): Promise<string> {
        return salida;
    }
}

interface ITraduccionLiteral extends ITraduccion {
    tipo: ETraduccion.literal;
    traduccion: NodeJS.Dict<string>;
}

export class TraduccionLiteral<T extends NodeJS.Dict<string>={}> extends Traduccion<T> {
    /* STATIC */

    /* INSTANCE */
    protected readonly traduccion: NodeJS.Dict<string>;

    public constructor(objLang: ITraduccionLiteral, fallbacks: NodeJS.Dict<string[]>) {
        super(objLang);

        this.traduccion = objLang.traduccion;
        for (const [key, values] of Object.entries(fallbacks)) {
            if (this.traduccion[key] == undefined && values != undefined) {
                for (const value of values) {
                    if (this.traduccion[value] != undefined) {
                        this.traduccion[key] = this.traduccion[value];
                        break;
                    }
                }
            }
        }

        // Bloqueamos el objeto para evitar modificaciones
        Object.freeze(this);
    }

    public async get(lang: Idioma, params?: Partial<T>): Promise<string> {
        return this.getString(lang.idioma, lang.defecto, params);
    }

    public async getString(lang: string, defecto: string, params?: Partial<T>): Promise<string> {
        const salida = this.traduccion[lang] ??=
            this.traduccion[lang.substring(0, 2)] ??=
            this.traduccion[defecto] ??=
            this.traduccion[""] ??=
            this.module_name;

        return this.render(this.aplicarParams(salida, params));
    }
}
