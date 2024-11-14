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
