/**
 * Editor: David Martínez Moya
 * Fecha: Wed, 27 May 2026 06:28:30 GMT
 * Hash: 6da29c4d4633e087aae54b2b2276d931
 * Versión: 2026.5.27+1-davidmartinezmoya
 */

import {TSendTaskType} from "./send-task";

export interface IPendingSendTask {
    id: number;
    type: TSendTaskType;
    schedule_at: number;
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

    public get schedule_at(): number {
        return this.data.schedule_at;
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
