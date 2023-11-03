export interface ITask {
    psRun: ()=>Promise<void>;
    psCancelado: (code: ETaskCancel, mensaje: string)=>Promise<void>;
    psError: (err: Error)=>Promise<void>;
}

export type TaskBuilder<T> = (mensaje: T)=>Promise<ITask>;

export enum ETaskCancel {
    USUARIO,
    SHUTDOWN,
    TIMEOUT,
}

export abstract class Task<T> implements ITask {
    /* STATIC */

    /* INSTANCE */
    protected constructor() {
    }

    public async psRun(): Promise<void> {

    }

    public async psCancelado(code: ETaskCancel, mensaje: string): Promise<void> {

    }

    public async psError(err: Error): Promise<void> {

    }
}
