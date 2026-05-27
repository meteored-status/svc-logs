/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 32a19b3c4492e9e354f4f9852647d159
 */

interface ITemplate {
    id: string;
    modulo: string;
    valores: string;
    defecto?: string;
}

export default ({id, modulo, valores, defecto}: ITemplate)=>`// NO EDITAR A MANO
import {TraduccionSet, type TValor} from "services-comun/modules/traduccion/set";

const id = "${modulo}.${id}";
const valores: TValor[] = ${valores};${defecto!=undefined?`\nconst defecto = \`${defecto}\`;`:""}

export default new TraduccionSet({
    id,
}, valores${defecto!=undefined?", defecto":""});
`;
