import {error, info} from "../../utiles/log";
import {IDAOFactory} from "../data/dao/d-a-o-factory";
import {PromiseDelayed} from "../../utiles/promise";
import {SendTaskController} from "../controller/send-task-controller";

export type ControllerBuilder = (sendTaskId: number, factory: IDAOFactory) => SendTaskController;

export class PendingSendTaskListener {
    /* STATIC */
    private static _instance: PendingSendTaskListener|null = null;

    public static listen(factory: IDAOFactory, controllerBuilder: ControllerBuilder): void {
        if (!this._instance) {
            this._instance = new PendingSendTaskListener(factory, controllerBuilder);
            this._instance.listen().then(() => {
                info('PendingSendTaskListener listening');
            }).catch(err => {
                error('PendingSendTaskListener error', err);
            });
        }
    }

    /* INSTANCE */
    private constructor(private readonly factory: IDAOFactory, private readonly controllerBuilder: ControllerBuilder) {
    }

    private async listen(): Promise<void> {
        this.factory.pendingSendTask.listen(pendingSendTask => {
            // Procesar el envío pendiente en segundo plano
            PromiseDelayed().then(async () => {
                try {
                    await this.controllerBuilder(pendingSendTask.id, this.factory).run();
                    pendingSendTask.complete();
                } catch (e) {
                    error('Error processing pending send task', e);
                }
            });
        }).catch(err => {
            error('Error listening pending send tasks', err);
        });
    }
}
