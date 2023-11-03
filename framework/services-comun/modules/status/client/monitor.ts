import {IMonitor, IResolutionGuide, TStatus} from "../common/interface";

export class Monitor {
    /* STATIC */
    public static build(name: string): Monitor {
        return new this(name);
    }

    /* INSTANCE */
    private _monitors: Monitor[];
    private _status: TStatus;
    private _updated: Date;
    private message?: string;
    private log?: string;
    private _resolution_guides?: IResolutionGuide[];

    private constructor(private readonly _name: string) {
        this._monitors = [];
        this._status = TStatus.UNKNOWN;
        this._updated = new Date();
    }

    public get name(): string {
        return this._name;
    }

    public get status(): TStatus {
        return this._status;
    }

    public set status(value: TStatus) {
        this._status = value;
    }

    public get updated(): Date {
        return this._updated;
    }

    public set updated(value: Date) {
        this._updated = value;
    }

    public get resolution_guides(): IResolutionGuide[]|undefined {
        return this._resolution_guides;
    }

    public addResolutionGuide(guide: IResolutionGuide): void {
        (this._resolution_guides??=[]).push(guide);
    }

    public addMonitor(monitor: Monitor): void {
        this._monitors.push(monitor);
    }

    public reset(): void {
        this._monitors = [];
    }

    public ok(msg?: string, log?: string): void {
        this.status = TStatus.OK;
        this.message = msg;
        this.log = log;
    }

    public error(msg: string, log?: string): void {
        this.status = TStatus.ERROR;
        this.message = msg;
        this.log = log;
    }

    public warn(msg: string, log?: string): void {
        this.status = TStatus.WARN;
        this.message = msg;
        this.log = log;
    }

    public toJSON(): IMonitor {
        return {
            name: this.name,
            status: this.status,
            updated: this.updated,
            monitors: this._monitors.map(m => m.toJSON()),
            message: this.message,
            log: this.log,
            resolution_guides: this._resolution_guides
        };
    }
}
