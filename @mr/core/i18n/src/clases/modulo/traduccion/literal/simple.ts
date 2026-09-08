/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 7c3237ef3266745345fc66868a6920e0
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
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
