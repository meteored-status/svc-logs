/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 6d5105bd61af2f659013c41f9f7f1619
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.27+1-davidmartinezmoya
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {TSendTaskType} from "./send-task";

export interface IPendingSendTask {
    id: number;
    type: TSendTaskType;
    schedule_at: number;
}

export class PendingSendTask {
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
