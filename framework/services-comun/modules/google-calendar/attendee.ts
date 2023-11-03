export interface IAttendee {
    val: string;
    params: {
        CN: string;
    }
}

export class Attendee {
    /* STATIC */

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
