export type TPluralKey = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type TOrigen = 'auto' | 'interno';
export type TVariable = 'literal' | 'map' | 'set';
export type TValue = 'singular' | 'plural';

type TLangCode = string;

export interface JSONItem {
    id: string;
    origen: TOrigen;
    tipo: TVariable;
    params?: string[];
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
