/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 611efe38039b355af98182a42fbf98e7
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
