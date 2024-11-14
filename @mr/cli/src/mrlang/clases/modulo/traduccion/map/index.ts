import {type ITraduccion as ITraduccionBase, Traduccion, type TraduccionTipo} from "..";
import type {Modulo} from "../..";
import params from "./params";
import simple from "./simple";

export interface ITraduccionMapValues {
    defecto?: string;
    valores: Record<string, string>;
}

interface ITraduccion extends ITraduccionBase<ITraduccionMapValues> {
    tipo: TraduccionTipo.map;
}

export class TraduccionMap extends Traduccion<ITraduccionMapValues> {
    /* INSTANCE */
    public readonly keys: string[];

    public constructor(modulo: Modulo, id: string, original: ITraduccion, nuevo: boolean = false) {
        super(modulo, id, original, nuevo);

        this.keys = [];
        for (const valor of Object.values(this.data.valor??{})) {
            this.keys.push(...Object.keys(valor!.valores).filter(key=>!this.keys.includes(key)).map(key=>key));
        }
        this.keys.push(...Object.keys(this.data.defecto?.valores??{}).filter(key=>!this.keys.includes(key)).map(key=>key));
    }

    public valores(jerarquia: string[]): ITraduccionMapValues {
        const salida: ITraduccionMapValues = {
            valores: {},
            defecto: this.defecto(jerarquia),
        };
        for (const key of this.keys) {
            const valor = this.valor(key, jerarquia);
            if (valor!=undefined) {
                salida.valores[key] = valor;
            }
        }

        return salida;
    }

    private valor(key: string, jerarquia: string[]): string|undefined {
        for (const idioma of jerarquia) {
            const dato = this.data.valor[idioma];
            if (dato!=undefined) {
                if (dato.valores[key] != undefined) {
                    return dato.valores[key];
                }
                if (dato.defecto!=undefined) {
                    return dato.defecto;
                }
            }
        }
        if (this.data.defecto?.valores[key]!=undefined) {
            return this.data.defecto.valores[key];
        }

        return undefined;
    }

    private defecto(jerarquia: string[]): string|undefined {
        for (const idioma of jerarquia) {
            const dato = this.data.valor[idioma];
            if (dato?.defecto!=undefined) {
                return dato.defecto;
            }
        }

        return undefined;
    }

    protected templateNoParams(jerarquia: string[]): string {
        const [valores, defecto] = this.parseValores(jerarquia);

        return simple({
            id: this.id,
            modulo: this.modulo.id,
            className: this.className,
            keys: this.keys,
            valores,
            defecto,
        });
    }

    protected templateParams(jerarquia: string[], parametros: string[]): string {
        const [valores, defecto] = this.parseValores(jerarquia);

        return params({
            id: this.id,
            modulo: this.modulo.id,
            className: this.className,
            keys: this.keys,
            params: parametros,
            valores,
            defecto,
        });
    }

    protected parseValores(jerarquia: string[]): [string, string?] {
        const values: string[] = [];
        const traduccion = this.valores(jerarquia);
        let defecto = traduccion.defecto;
        for (const key of this.keys) {
            const valor = traduccion.valores[key];
            if (valor!=undefined) {
                values.push(`    "${key}": \`${valor}\``);
            } else if (defecto==undefined) {
                defecto = `${this.modulo.id}.${this.id}`.toUpperCase();
            }
        }

        if (values.length>0) {
            return [`{\n${values.join(",\n")},\n}`, defecto];
        }

        return [`{}`, defecto];
    }
}
