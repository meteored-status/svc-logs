import {IDAOFactory} from "../data/dao/d-a-o-factory";
import {Send, TStatus} from "../data/model/send";
import {error, info} from "../../utiles/log";
import {SenderBuilder} from "../sender/sender-builder";

export abstract class SendPendingController {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly factory: IDAOFactory) {
    }

    public async run(): Promise<void> {
        const pendingSends = await this.factory.send.getPending();

        await Promise.all(pendingSends.map(async send => {
            await this.runSend(send);
        }));
    }

    private async runSend(send: Send): Promise<void> {
        try {
            const sender = SenderBuilder.getInstance().build(send);

            sender.onOK = () => {
                send.status = TStatus.SEND;
                send.tries = send.tries + 1;
            }

            sender.onKO = () => {
                send.status = send.tries >= 3 ? TStatus.ERROR : TStatus.PENDING;
                send.tries = send.tries + 1;
            }

            info(`Reenviando email ${send.sendTaskId}`);
            await sender.run();

            // Guardamos el envío
            await this.factory.send.save(send);

        } catch (e) {
            error(`Error al enviar el envío ${send.metadata.id}`, e);
        }
    }
}
