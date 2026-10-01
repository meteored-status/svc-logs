/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: cf0e78eb2e5724418d2e83733e43afee
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export interface IAttendee {
    val: string;
    params: {
        CN: string;
    }
}

export class Attendee {
    /* INSTANCE */
    public constructor(private readonly _data: IAttendee) {
    }

    protected get data(): IAttendee {
        return this._data;
    }

    public get mail(): string {
        if (this.data.params.CN) {
            return this.data.params.CN.trim();
        }
        if (this.data.val && this.data.val.indexOf('mailto:') == 0) {
            return this.data.val.substring(7).trim();
        }
        return '';
    }
}
