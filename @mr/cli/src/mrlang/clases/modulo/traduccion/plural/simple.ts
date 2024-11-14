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
