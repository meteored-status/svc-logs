/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 929af1fa9930e37697a0924888784140
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {TParams, Value} from "./value";


export class SingularValue<T extends TParams={}> extends Value<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly _value: string, params?: string[]) {
        super(params ?? []);
    }

    public override value(params?: Partial<T>): string {
        return this.applyParams(this._value, params)
    }
}
