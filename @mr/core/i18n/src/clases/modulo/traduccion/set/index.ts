/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 2fc18f5fabfbbce1bf7b57d57bf87bc8
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type ITraduccion as ITraduccionBase, Traduccion, TraduccionTipo} from "..";
import type {Modulo} from "../..";
import params from "./params";
import simple from "./simple";

/**
 * Un valor de un `set` de traducciones: una cadena, o `null` para un hueco.
 *
 * Copia local del `TValor` de `services-comun/modules/traduccion/set`. Es una línea, y traerla
 * aquí es lo que deja a `@mr/core-i18n` sin dependencia a `services-comun`. No hay riesgo de que
 * se separen del original sin avisar: el tipo es estructural, así que el código v1 que genera
 * este mismo fichero —que sí importa el de `services-comun`— seguiría encajando aunque uno de
 * los dos cambiara.
 */
export type TValor = string|null;

export interface ITraduccionSetValues {
    defecto?: string;
    valores: TValor[];
}

interface ITraduccion extends ITraduccionBase<ITraduccionSetValues> {
    tipo: TraduccionTipo.set;
}

export class TraduccionSet extends Traduccion<ITraduccionSetValues> {
    /* STATIC */

    /* INSTANCE */
    protected herencia: string;
    protected herenciaClass: string;

    public constructor(modulo: Modulo, id: string, data: ITraduccion) {
        super(modulo, id, data);

        this.herencia = "set";
        this.herenciaClass = "Set";
    }

    public valores(jerarquia: string[]): ITraduccionSetValues {
        for (const idioma of jerarquia) {
            if (this.data.valor[idioma] != undefined) {
                return this.data.valor[idioma];
            }
        }
        return this.data.defecto ?? {
            valores: [],
        };
    }

    protected templateNoParams(jerarquia: string[]): string {
        const [valores , defecto] = this.parseValores(jerarquia);

        return simple({
            id: this.id,
            modulo: this.modulo.id,
            valores,
            defecto,
        });
    }

    protected templateParams(jerarquia: string[], parametros: string[]): string {

        const [valores , defecto] = this.parseValores(jerarquia);
        return params({
            id: this.id,
            modulo: this.modulo.id,
            className: this.className,
            params: parametros,
            valores,
            defecto,
        });
    }

    protected parseValores(jerarquia: string[]): [string, string?] {
        const values: string[] = [];
        const traduccion = this.valores(jerarquia);
        const defecto = traduccion.defecto;
        for (const valor of traduccion.valores??[]) {
            if (valor!=null) {
                values.push(`    \`${valor}\``);
            } else {
                values.push(`    undefined`);
            }
        }

        if (values.length>0) {
            return [`[\n${values.join(",\n")},\n]`, defecto];
        }

        return [`[]`, defecto];
    }
}
