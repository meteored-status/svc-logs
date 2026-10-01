/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 02fdba470d369634f344d13a05f20fbd
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

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
