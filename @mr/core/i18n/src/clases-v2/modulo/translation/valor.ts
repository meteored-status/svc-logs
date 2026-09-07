/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 028c48d92b77cab7a10dffd9de54de75
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.2+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Cómo se escribe **un valor** —un `SingularValue` o un `PluralValue`— en el fichero generado.
 *
 * Existe porque los tres emisores (`literal.ts`, `map.ts`, `set.ts`) hacían exactamente esto, cada uno con su
 * copia, y lo que cambia entre ellos es solo **en qué lo envuelven después**: un `Literal`, un
 * `TranslationMap` o un `TranslationSet`. Tener el valor escrito tres veces es lo que los hizo divergir dos
 * veces seguidas, y las dos compilando: `set.ts` se dejó el array de `params` del `SingularValue` —así que
 * los `{{n}}` de un `set` se pintaban literales— y `literal.ts` copió de su propia rama del singular una
 * variable que en la del plural no existía.
 */

import {JSONItem, JSONValue, JSONValuePlural, JSONValueSingular} from "../../data";
import {Definition} from "../definition";
import {definitionModulePath} from "./common";
import {argumentoCounter} from "./plural";
import {ModuloJSON} from "../json";
import {pascalCase} from "../../util/case";

/**
 * Un valor ya escrito, listo para meter en el fichero.
 *
 * @property imports  - Lo que hay que importar para que esas líneas compilen. El llamante los junta en un
 *                      `Set`, porque un `map` con veinte valores repite los mismos.
 * @property lineas   - Las declaraciones, en orden.
 * @property variable - Cómo se llama lo que queda declarado, para que el llamante lo envuelva.
 */
export interface IValorEmitido {
    imports: string[];
    lineas: string[];
    variable: string;
}

/**
 * Escribe un valor.
 *
 * @param value      - El valor tal y como viene del `.json`.
 * @param item       - La entrada a la que pertenece: de ahí salen los `params` y el `counter`, que son de la
 *                     entrada entera y no de cada valor.
 * @param module     - Módulo, para la ruta de las definiciones.
 * @param definition - Donde se registran los tipos de parámetros.
 * @param langKey    - Idioma normalizado, el que decide las reglas de plural.
 * @param sufijo     - Qué se le pega al nombre de las variables. Vacío cuando el fichero declara un solo
 *                     valor (`literal`); el índice cuando declara varios (`map`, `set`).
 */
export const emitirValor = (value: JSONValue, item: JSONItem, module: ModuloJSON, definition: Definition, langKey: string, sufijo: string): IValorEmitido => {
    const paramDefinition = pascalCase(`${item.id}Params`);
    const params = item.params ?? [];
    const imports: string[] = [];
    const lineas: string[] = [];

    if (params.length > 0) {
        imports.push(`import type {${paramDefinition}} from "${definitionModulePath(module)}";`);
        definition.addParamDefinition(paramDefinition, params);
    }

    // El genérico de la firma **y** el array de nombres: el primero es lo que tipa la llamada y el segundo lo
    // único que hace que `applyParams()` sustituya algo. Van juntos siempre, que separarlos fue el fallo del
    // `set`: compilaba y no sustituía.
    const generico = params.length > 0 ? `<${paramDefinition}>` : "";
    const listaParams = params.length > 0 ? `, ["${params.join("\", \"")}"]` : "";

    if (value.type == "singular") {
        imports.push(`import {SingularValue} from "@mr/core-i18n/value/singular-value";`);
        lineas.push(`const value${sufijo} = \`${(value as JSONValueSingular).value}\`;`);
        lineas.push(`const singularValue${sufijo} = new SingularValue${generico}(value${sufijo}${listaParams});`);

        return {imports, lineas, variable: `singularValue${sufijo}`};
    }

    imports.push(`import pluralBuilder from "@mr/core-i18n/util/plural-function-builder";`);
    imports.push(`import {PluralValue} from "@mr/core-i18n/value/plural-value";`);
    imports.push(`import {TPluralKey} from "@mr/core-i18n/value";`);

    lineas.push(`const values${sufijo}: Partial<Record<TPluralKey, string>> = {`);
    for (const [categoria, forma] of Object.entries((value as JSONValuePlural).value)) {
        lineas.push(`    ${categoria}: "${forma}",`);
    }
    lineas.push('};');
    // El `counter` solo se emite si la entrada lo declara; con un único parámetro el runtime lo deduce.
    lineas.push(`const pluralValue${sufijo} = new PluralValue${generico}(values${sufijo}, pluralBuilder('${langKey}')${listaParams}${params.length > 0 ? argumentoCounter(item) : ""});`);

    return {imports, lineas, variable: `pluralValue${sufijo}`};
}
