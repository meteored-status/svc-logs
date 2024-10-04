interface ITemplate {
    id: string;
    modulo: string;
    className: string;
    keys: string[];
    params: string[];
    valores: string;
    defecto?: string;
}

export default ({id, modulo, className, params, valores, defecto}: ITemplate)=>`// NO EDITAR A MANO
import {ITraduccionMapValores, TraduccionMap} from "services-comun/modules/traduccion/map";

import type {${className}Record, ${className}Params} from "../../${"../".repeat(modulo.split(".").length)}${modulo.replaceAll("-", "_").replaceAll(".","/")}";

const id = "${modulo}.${id}";
const params: string[] = [${params.map(param=>`"${param}"`).join(", ")}];
const valor: ITraduccionMapValores<${className}Record> = ${valores};${defecto==undefined?"":`\nconst defecto = \`${defecto}\`;`}

export default new TraduccionMap<${className}Record, ${className}Params>({
    id,
    params,
}, valor${defecto==undefined?"":", defecto"});
`;
