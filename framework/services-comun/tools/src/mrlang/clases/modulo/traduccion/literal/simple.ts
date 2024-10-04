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
