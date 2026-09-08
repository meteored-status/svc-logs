/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 611efe38039b355af98182a42fbf98e7
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

interface ITemplate {
    id: string;
    modulo: string;
    valores: string;
    defecto: string;
}

export default ({id, modulo, defecto, valores}: ITemplate)=>`// NO EDITAR A MANO
import {TraduccionPlural} from "services-comun/modules/traduccion/plural";

const id = "${modulo}.${id}";
const defecto = \`${defecto}\`;
const valores: Record<number, string> = ${valores};

export default new TraduccionPlural({
    id,
}, defecto, valores);
`;
