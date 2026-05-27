/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: fa93d184ba5b779cea3f027ed411f6f1
 */

interface ITemplate {
    id: string;
    modulo: string;
    className: string;
    params: string[];
    valores: string;
    defecto?: string;
}

export default ({id, modulo, className, params, valores, defecto}: ITemplate)=>`// NO EDITAR A MANO
import {TraduccionSet, type TValor} from "services-comun/modules/traduccion/set";

import type {${className}Params} from "../../${"../".repeat(modulo.split(".").length)}${modulo.replaceAll("-", "_").replaceAll('.','/')}";

const id = "${modulo}.${id}";
const params: string[] = [${params.map(param=>`"${param}"`).join(", ")}];
const valores: TValor[] = ${valores};${defecto!=undefined?`\nconst defecto = \`${defecto}\`;`:""}

export default new TraduccionSet<${className}Params>({
    id,
    params,
}, valores${defecto!=undefined?", defecto":""});
`;
