/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: e775aefb05f452d4326edc0f8f706e39
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.6.17+7-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type TParams, Value} from "./value/value";
import {Translation} from ".";

export class Literal<T extends TParams={}> extends Translation<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _value: Value) {
        super();
    }

    public render(params?: Partial<T>): string {
        return this._value.value(params);
    }

}
