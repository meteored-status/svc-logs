import {Message} from "@google-cloud/pubsub";

import {ETaskCancel, ITask, TaskBuilder} from "./task";
import {error} from "../../utiles/log";

enum MensajeEstado {
    RECIBIDO,
    CANCELADO,
    PROCESANDO,
    FINALIZADO,
    ERROR,
}

export class Mensaje<T> {
    /* STATIC */
    private static PENDIENTES = [
        MensajeEstado.RECIBIDO,
        MensajeEstado.PROCESANDO,
    ];
    private static TERMINADOS = [
        MensajeEstado.CANCELADO,
        MensajeEstado.ERROR,
        MensajeEstado.FINALIZADO,
    ];

    /* INSTANCE */
    public estado: MensajeEstado;
    public payload: T;

    private readonly handler: Promise<ITask>;

    public constructor(protected readonly message: Message, builder: TaskBuilder<T>) {
        this.estado = MensajeEstado.RECIBIDO;
        this.payload = JSON.parse(message.data.toString()) as T;
        this.handler = builder(this.payload);
    }

    public async init(): Promise<void> {
        await this.handler;
    }

    public async cancelar(motivo: ETaskCancel, mensaje: string): Promise<void> {
        if (Mensaje.TERMINADOS.includes(this.estado)) {
            return;
        }

        this.estado = MensajeEstado.CANCELADO;
        await this.message.nackWithResponse();

        const handler = await this.handler;
        await handler.psCancelado(motivo, mensaje)
    }

    public async procesar(): Promise<void> {
        if (Mensaje.TERMINADOS.includes(this.estado)) {
            return;
        }

        const handler = await this.handler;

        this.estado = MensajeEstado.PROCESANDO;
        await handler.psRun();
        await this.finalizar();
    }

    public async finalizar(): Promise<void> {
        if (Mensaje.TERMINADOS.includes(this.estado)) {
            return;
        }

        this.estado = MensajeEstado.FINALIZADO;
        await this.message.ackWithResponse();
    }

    public async error(err: Error): Promise<void> {
        // if ([
        //     MensajeEstado.FINALIZADO,
        //     MensajeEstado.ERROR,
        // ].includes(this.estado)) {
        //     return;
        // }
        this.estado = MensajeEstado.ERROR;
        await this.message.nackWithResponse();
        const handler = await this.handler.catch(()=>null);
        if (handler==null) {
            error("Error en el handler", err);
        } else {
            try {
                await handler.psError(err);
            } catch (e) {

            }
        }
    }
}
