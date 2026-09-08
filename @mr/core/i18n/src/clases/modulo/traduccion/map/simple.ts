/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 7d23d15809f9320ed9fc17ee9bcb7afa
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
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
