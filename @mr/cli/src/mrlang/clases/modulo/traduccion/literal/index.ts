import {type ITraduccion as ITraduccionBase, Traduccion, type TraduccionTipo} from "..";
import type {Modulo} from "../..";
import params from "./params";
import simple from "./simple";

export type ITraduccionLiteralValues = string;

interface ITraduccion extends ITraduccionBase<ITraduccionLiteralValues> {
    tipo: TraduccionTipo.literal;
}

export class TraduccionLiteral extends Traduccion<ITraduccionLiteralValues> {
    /* INSTANCE */
    public constructor(modulo: Modulo, id: string, data: ITraduccion) {
        super(modulo, id, data);
    }

    public valores(jerarquia: string[]): ITraduccionLiteralValues {
        for (const idioma of jerarquia) {
            if (this.data.valor[idioma] != undefined) {
                return this.data.valor[idioma];
            }
        }
        return this.data.defecto ?? this.id.toUpperCase();
    }

    protected templateNoParams(jerarquia: string[]): string {
        return simple({
            id: this.id,
            modulo: this.modulo.id,
            valores: this.valores(jerarquia),
        });
    }

    protected templateParams(jerarquia: string[], parametros: string[]): string {
        return params({
            id: this.id,
            modulo: this.modulo.id,
            className: this.className,
            params: parametros,
            valores: this.valores(jerarquia),
        });
    }
}
