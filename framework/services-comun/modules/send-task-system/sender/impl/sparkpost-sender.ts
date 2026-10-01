/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 01c0b29f6b621fb99eba5125fc83c178
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.27+1-davidmartinezmoya
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Sender} from "../sender";
import type {SparkpostSend} from "../../data/model/sparkpost-send";
import {SparkPostManager} from "../../../email/managers/spark_post";
import {error, info} from "../../../utiles/log";
import {PromiseDelayed} from "../../../utiles/promise";

export type TransmissionID = string;

export class SparkpostSender extends Sender<TransmissionID | null> {
    /* INSTANCE */
    public constructor(send: SparkpostSend) {
        super(send);
    }

    protected override get send(): SparkpostSend {
        return super.send as SparkpostSend;
    }

    public override async run(): Promise<TransmissionID | null> {
        const email = this.send.email;

        if (!email) {
            error(`No se ha proporcionado un email para enviar.`);
            this.koHandler?.();
            return null;
        }

        const sparkpost = await SparkPostManager.build();

        let transmissionId: string | undefined = undefined;
        let contador: number = 0;

        while (!transmissionId && contador < 3) {
            try {
                info(`Enviando email a SparkPost. Intento ${contador + 1}`);
                await PromiseDelayed(Math.random() * 1000);
                const result = await sparkpost.send(email);
                transmissionId = result.results.id;

                if (transmissionId) {
                    info(`Email enviado a SparkPost. ID: ${transmissionId}`);
                } else {
                    error(`Esto no debe ocurrir. No se ha devuelto un ID de transmisión.`);
                    contador++;
                }
            } catch (e) {
                error(`Error al enviar el email a SparkPost: `, e);
                contador++;
            }
        }

        if (transmissionId) {
            this.send.transmissionId = transmissionId;
            this.okHandler?.(transmissionId);
        } else {
            this.koHandler?.();
        }

        return transmissionId || null;
    }
}
