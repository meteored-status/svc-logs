/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 03 Sep 2026 13:36:43 GMT
 * Hash: 907aad7d3d96986682af624ac8c90cba
 * Versión: 2026.9.3+3-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import {BOUNCE_CLASS_AUTO_REPLY, BOUNCE_CLASS_SUPPRESSED, categoriaRebote, claseRebote} from "../../../email/webhook/sparkpost/bounce-class";
import {esRebote} from "../../../email/webhook/sparkpost/sparkpost";
import {Calculator} from "../calculator";
import {SparkpostEvent} from "../../data/model/sparkpost-event";
import {Receiver} from "../../data/model/receiver";

export class SparkpostCalculator extends Calculator {
    /* STATIC */

    /* INSTANCE */
    public constructor(event: SparkpostEvent) {
        super(event);
    }

    protected override get event(): SparkpostEvent {
        return this._event as SparkpostEvent;
    }

    public calculate(receiver: Receiver): void {
        const e = this.event.messageData;

        const eventTime = parseInt(e.timestamp) * 1000;

        switch (e.type) {
            case "delivery":
                receiver.statistics!.received = true;
                receiver.statistics!.received_time = eventTime;
                break;
            case "bounce":
                receiver.statistics!.bounce = true;
                receiver.statistics!.bounce_count++;
                this.clasificar(receiver);
                break;
            case "out_of_band":
                this.rebotarTrasEntrega(receiver);
                break;
            case "spam_complaint":
                receiver.statistics!.spam = true;
                receiver.statistics!.spam_count++;
                break;
            case "initial_open":
            case "amp_initial_open":
                receiver.statistics!.times_opened++;
                receiver.statistics!.first_open_count++;

                if (!receiver.statistics!.first_open_time || receiver.statistics!.first_open_time > eventTime) {
                    receiver.statistics!.first_open_time = eventTime;
                    if (receiver.statistics!.received_time) {
                        receiver.statistics!.time_until_open = eventTime - receiver.statistics!.received_time;
                    }
                }
                break;
            case "open":
            case "amp_open":
                receiver.statistics!.times_opened++;

                if (!receiver.statistics!.first_open_time || receiver.statistics!.first_open_time > eventTime) {
                    receiver.statistics!.first_open_time = eventTime;
                    if (receiver.statistics!.received_time) {
                        receiver.statistics!.time_until_open = eventTime - receiver.statistics!.received_time;
                    }
                }
                break;
            case "click":
            case "amp_click":
                receiver.statistics!.times_clicked++;
                break;
            case "list_unsubscribe":
            case "link_unsubscribe":
                receiver.statistics!.unsubscribe = true;
                receiver.statistics!.unsubscribe_count++;
                break;

        }
    }

    /**
     * Aplica un rebote asíncrono (`out_of_band`). El proveedor ya emitió un `delivery` por este
     * mensaje —el MTA remoto lo aceptó y lo devolvió después—, así que **la recepción se retira**:
     * el correo no llegó al buzón. `received_time` se conserva, porque la aceptación sí ocurrió.
     *
     * La excepción son las autorespuestas de ausencia, que Sparkpost entrega por este mismo canal
     * pese a no ser un fallo: ahí el mensaje se entregó y la recepción se respeta.
     */
    private rebotarTrasEntrega(receiver: Receiver): void {
        const clase = this.clasificar(receiver);

        if (clase === BOUNCE_CLASS_AUTO_REPLY) {
            return;
        }

        receiver.statistics!.bounce = true;
        receiver.statistics!.bounce_count++;
        receiver.statistics!.undelivered = true;
        receiver.statistics!.received = false;
    }

    /**
     * Anota la clase y la categoría del rebote, y marca las direcciones que el proveedor se negó a
     * enviar por estar en su lista de supresión.
     *
     * Se queda con la clase del rebote **más reciente**, salvo que sea una autorespuesta: esa no
     * pisa la de un fallo anterior, porque describe un mensaje que sí llegó.
     *
     * @returns La clase del evento, o `undefined` si no era un rebote o no traía clase.
     */
    private clasificar(receiver: Receiver): number|undefined {
        const evento = this.event.messageData;

        if (!esRebote(evento)) {
            return undefined;
        }

        const clase = claseRebote(evento.bounce_class);

        if (clase === undefined) {
            return undefined;
        }

        if (clase === BOUNCE_CLASS_SUPPRESSED) {
            receiver.statistics!.suppressed = true;
        }

        if (clase !== BOUNCE_CLASS_AUTO_REPLY || receiver.statistics!.bounce_class === undefined) {
            receiver.statistics!.bounce_class = clase;
            receiver.statistics!.bounce_category = categoriaRebote(clase);
        }

        return clase;
    }
}
