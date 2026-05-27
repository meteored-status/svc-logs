/**
 * Editor: David Martínez Moya
 * Fecha: Wed, 27 May 2026 06:28:30 GMT
 * Hash: 90fa1a6d3cdcfe73ab5bbc2cb2efe8c8
 * Versión: 2026.5.27+1-davidmartinezmoya
 */

import {Sender} from "../sender";
import {SparkpostSend} from "../../data/model/sparkpost-send";
import {SparkPostManager} from "../../../email/managers/spark_post";
import {error, info} from "../../../utiles/log";
import {PromiseDelayed} from "../../../utiles/promise";

export type TransmissionID = string;

export class SparkpostSender extends Sender<TransmissionID | null> {
    /* STATIC */

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
