/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 0a8b25ce370443b405fe332549c038bc
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.27+1-davidmartinezmoya
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {error, info} from "../../utiles/log";
import type {IDAOFactory} from "../data/dao/d-a-o-factory";
import {PromiseDelayed} from "../../utiles/promise";
import type {SendTaskController} from "../controller/send-task-controller";
import type {PendingSendTask} from "../data/model/pending-send-task";

export type ControllerBuilder = (sendTask: PendingSendTask, factory: IDAOFactory) => SendTaskController;

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
                    await this.controllerBuilder(pendingSendTask, this.factory).run();
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
