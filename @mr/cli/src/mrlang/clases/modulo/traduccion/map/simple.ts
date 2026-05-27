/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 7d23d15809f9320ed9fc17ee9bcb7afa
 */

interface ITemplate {
    id: string;
    modulo: string;
    className: string;
    keys: string[];
    valores: string;
    defecto?: string;
}

export default ({id, modulo, className, valores, defecto}: ITemplate)=>`// NO EDITAR A MANO
import {ITraduccionMapValores, TraduccionMap} from "services-comun/modules/traduccion/map";

import type {${className}Record} from "../../${"../".repeat(modulo.split(".").length)}${modulo.replaceAll("-", "_").replaceAll(".","/")}";

const id = "${modulo}.${id}";
const valor: ITraduccionMapValores<${className}Record> = ${valores};${defecto==undefined?"":`\nconst defecto = \`${defecto}\`;`}

export default new TraduccionMap<${className}Record>({
    id,
}, valor${defecto==undefined?"":", defecto"});
`;
