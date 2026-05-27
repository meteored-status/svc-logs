/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 7c3237ef3266745345fc66868a6920e0
 */

interface ITemplate {
    id: string;
    modulo: string;
    valores: string;
}

export default ({id, modulo, valores}: ITemplate)=>`// NO EDITAR A MANO
// const id = "${modulo}.${id}";
const valor = \`${valores}\`;

export default valor;
`;
// export default ({id, modulo, valores}: ITemplate)=>`// NO EDITAR A MANO
// import {TraduccionLiteral} from "services-comun/modules/traduccion/literal";
//
// const id = "${modulo}.${id}";
// const valor = \`${valores}\`;
//
// export default new TraduccionLiteral({
//     id,
// }, valor);
// `;
