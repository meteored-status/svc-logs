interface ITemplate {
    id: string;
    modulo: string;
    className: string;
    params: string[];
    defecto: string;
    valores: string;
}

export default ({id, modulo, className, params, defecto, valores}: ITemplate)=>`// NO EDITAR A MANO
import {TraduccionPlural} from "services-comun/modules/traduccion/plural";

import type {${className}Params} from "../../${"../".repeat(modulo.split(".").length)}${modulo.replaceAll("-", "_").replaceAll(".", "/")}";

const id = "${modulo}.${id}";
const params: string[] = [${params.map(param=>`"${param}"`).join(", ")}];
const defecto = \`${defecto}\`;
const valores: Record<number, string> = ${valores};

export default new TraduccionPlural<${className}Params>({
    id,
    params,
}, defecto, valores);
`;
