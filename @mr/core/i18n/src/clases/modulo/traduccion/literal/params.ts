/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 1c25deb47ec5dda53e00c49f4085e9ce
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

interface ITemplate {
    id: string;
    modulo: string;
    className: string;
    params: string[];
    valores: string;
}

export default ({id, modulo, className, params, valores}: ITemplate)=>`// NO EDITAR A MANO
import {TraduccionLiteral} from "services-comun/modules/traduccion/literal";

import type {${className}Params} from "../../${"../".repeat(modulo.split(".").length)}${modulo.replaceAll("-", "_").replaceAll('.','/')}";

const id = "${modulo}.${id}";
const params: string[] = [${params.map(param=>`"${param}"`).join(", ")}];
const valor = \`${valores}\`;

export default new TraduccionLiteral<${className}Params>({
    id,
    params,
}, valor);
`;
