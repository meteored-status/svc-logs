/**
 * Editor: David Martínez Moya
 * Fecha: Wed, 27 May 2026 06:28:30 GMT
 * Hash: 34afa83336bdde8789be67585a5ef451
 * Versión: 2026.5.27+1-davidmartinezmoya
 */

import {Send, TStatus} from "../data/model/send";
import {SendTaskInstance} from "../data/model/send-task-instance";
import {SenderBuilder} from "../sender/sender-builder";
import {IDAOFactory} from "../data/dao/d-a-o-factory";
import {ReceiverIdentifierBuilder} from "../receiver/receiver-identifier-builder";
import {Receiver} from "../data/model/receiver";
import {PendingSendTask} from "../data/model/pending-send-task";

export abstract class SendTaskController {
    /* STATIC */

    /* INSTANCE */
    protected constructor(
        private readonly _sendTask: PendingSendTask,
        private readonly factory: IDAOFactory
    ) {
    }

    public get sendTask(): PendingSendTask {
        return this._sendTask;
    }

    public async run(): Promise<void> {
        // Creamos la instancia de la tarea
        const sendTaskInstance = SendTaskInstance.create(this.sendTask.id);

        const sends = await this.buildSends();

        await Promise.all(sends.map(async send => {
            send.sendTaskInstanceId = sendTaskInstance.id;
            await this.runSend(send)
        }));

        await this.onSend();
    }

    protected abstract buildSends(): Promise<Send[]>;

    protected abstract onSend(): Promise<void>;

    private async runSend(send: Send): Promise<void> {
        const sender = SenderBuilder.getInstance().build(send);

        sender.onOK = () => {
            send.status = TStatus.SEND;
            send.tries = send.tries + 1;
        }

        sender.onKO = () => {
            send.status = TStatus.PENDING;
            send.tries = 1;
        }

        await sender.run();

        // Guardamos el envío
        await this.factory.send.save(send);

        // Creamos los receptores y los guardamos
        const receiverIds = ReceiverIdentifierBuilder.getInstance().build(send).identify();

        await Promise.all(receiverIds.map(async receiverId => {
            const receiver = Receiver.create(receiverId, send.id, send.sendTaskId, send.sendTaskInstanceId!);
            await this.factory.receiver.save(receiver);
        }));
    }
}
