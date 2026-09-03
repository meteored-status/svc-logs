/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:14:26 GMT
 * Hash: f0a17864336fbdf6f57a80e4185a7653
 * Versión: 2026.9.2+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export type TPluralKey = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type TOrigen = 'auto' | 'interno';
export type TVariable = 'literal' | 'map' | 'set';
export type TValue = 'singular' | 'plural';

type TLangCode = string;

/**
 * Una entrada del módulo, tal y como se escribe en el `.json`.
 *
 * @property id      - Nombre con el que se accede desde el código.
 * @property origen  - De dónde sale el texto.
 * @property tipo    - `literal`, `map` o `set`.
 * @property params  - Variables que interpola el texto, escritas `{{así}}`.
 * @property counter - Cuál de los `params` es **el número que decide la forma del plural**. Solo tiene sentido
 *                     en una entrada con algún valor de tipo `plural`. Se puede omitir cuando hay un único
 *                     parámetro —se deduce que es ese, y por eso los módulos escritos antes de que este campo
 *                     existiera siguen valiendo—; con dos o más es obligatorio, porque nada dice que el
 *                     contador sea el primero: en «{{n}} de {{total}}» el número que manda es `n`, y en
 *                     «{{total}} en {{n}} días» es el segundo.
 */
export interface JSONItem {
    id: string;
    origen: TOrigen;
    tipo: TVariable;
    params?: string[];
    counter?: string;
    values: {
        valor: {
            [key: TLangCode]: JSONValor;
        };
        defecto?: JSONValor;
    }
}

export interface JSONValue {
    type: TValue;
}

export interface JSONValueSingular extends JSONValue {
    type: 'singular';
    value: string;
}

export interface JSONValuePlural extends JSONValue {
    type: 'plural';
    value: Partial<Record<TPluralKey, string>>;
}

export interface JSONValor {
}

export interface JSONValorMap extends JSONValor {
    valores: {
        [key: string]: JSONValue;
    }
}

export interface JSONValorSet extends JSONValor {
    valores: JSONValue[];
}

export interface JSONItemLiteral extends JSONItem {
    tipo: 'literal';
    values: {
        valor: {
            [key: TLangCode]: JSONValue;
        },
        defecto?: JSONValue;
    }
}

export interface JSONItemMap extends JSONItem {
    tipo: 'map';
    values: {
        valor: {
            [key: TLangCode]: JSONValorMap;
        },
        defecto?: {
            valores: {
                [key: string]: JSONValue;
            }
        }
    }
}

export interface JSONItemSet extends JSONItem {
    tipo: 'set';
    values: {
        valor: {
            [key: TLangCode]: JSONValorSet
        },
        defecto?: {
            valores: JSONValue[];
        }
    }
}
