import {TSendTaskType} from "./send-task";

export interface IPendingSendTask {
    id: number;
    type: TSendTaskType;
}

export class PendingSendTask {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _data: IPendingSendTask, private readonly _onComplete?: () => void) {
    }

    protected get data(): IPendingSendTask {
        return this._data;
    }

    public get id(): number {
        return this.data.id;
    }

    public get type(): TSendTaskType {
        return this.data.type;
    }

    public raw(): IPendingSendTask {
        return {
            ...this.data
        };
    }

    public complete(): void {
        this._onComplete?.();
    }
}
