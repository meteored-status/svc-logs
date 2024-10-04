import {type ITraduccion as ITraduccionBase, Traduccion, type TraduccionTipo} from "..";
import type {Modulo} from "../..";
import params from "./params";
import simple from "./simple";

export type ITraduccionPluralValues = Record<string, string> & {
    "": string;
};

export type ITraduccionPluralGenValues = Record<number, string> & {
    "": string;
}

interface ITraduccion extends ITraduccionBase<ITraduccionPluralValues> {
    tipo: TraduccionTipo.plural;
}

export class TraduccionPlural extends Traduccion<ITraduccionPluralGenValues> {
    /* INSTANCE */
    protected herencia: string;
    protected herenciaClass: string;

    public constructor(modulo: Modulo, id: string, data: ITraduccion) {
        // todo convertir Record<string, string> a Record<number, string>
        super(modulo, id, data);

        this.herencia = "plural";
        this.herenciaClass = "Plural";
    }

    public valores(jerarquia: string[]): ITraduccionPluralValues {
        for (const idioma of jerarquia) {
            if (this.data.valor[idioma] != undefined) {
                return this.data.valor[idioma];
            }
        }
        return this.data.defecto ?? {"": this.id.toUpperCase()};
    }

    protected templateNoParams(jerarquia: string[]): string {
        const [valores, defecto] = this.parseValores(jerarquia);

        return simple({
            id: this.id,
            modulo: this.modulo.id,
            defecto,
            valores,
        });
    }

    protected templateParams(jerarquia: string[], parametros: string[]): string {
        const [valores, defecto] = this.parseValores(jerarquia);

        return params({
            id: this.id,
            modulo: this.modulo.id,
            className: this.className,
            params: parametros,
            defecto,
            valores,
        });
    }

    protected parseValores(jerarquia: string[]): [string, string] {
        const values: string[] = [];
        const traduccion = this.valores(jerarquia);
        let defecto = traduccion[""];
        for (const key of Object.keys(traduccion).filter(key=>key!="")) {
            const valor = traduccion[key];
            values.push(`    ${key}: \`${valor}\``);
        }

        if (values.length>0) {
            return [`{\n${values.join(",\n")},\n}`, defecto];
        }

        return [`{}`, defecto];
    }
}
