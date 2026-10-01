/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: d09bfe1884f296f84a1e6f2640e952fb
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.27+1-davidmartinezmoya
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Send} from "../data/model/send";
import {TStatus} from "../data/model/send";
import {SendTaskInstance} from "../data/model/send-task-instance";
import {SenderBuilder} from "../sender/sender-builder";
import type {IDAOFactory} from "../data/dao/d-a-o-factory";
import {ReceiverIdentifierBuilder} from "../receiver/receiver-identifier-builder";
import {Receiver} from "../data/model/receiver";
import type {PendingSendTask} from "../data/model/pending-send-task";

export abstract class SendTaskController {
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
