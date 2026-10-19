/**
 * Editor: Juan C. Martínez
 * Fecha: Fri, 09 Oct 2026 06:20:32 GMT
 * Hash: 6ad0b6725387ad3d7f45e98df6b7547b
 * Versión: 2026.10.9+1-juancmartinez
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import type {Message as PubSubMessage} from "@google-cloud/pubsub";

export class Message<T> {
    /* INSTANCE */
    public get data(): T {
        return JSON.parse(this.msg.data.toString());
    }

    /**
     * Los atributos del mensaje de Pub/Sub (los que se envian con `sendMessage({json, attributes})`); vacio si no trae ninguno. Son los mismos por
     * los que puede filtrar una suscripcion (`attributes.clave = "valor"`).
     */
    public get attributes(): Readonly<Record<string, string>> {
        return this.msg.attributes ?? {};
    }

    public constructor(private readonly msg: PubSubMessage) {
    }

    public accept(): void {
        this.msg.ack();
    }

    public dismiss(): void {
        this.msg.ack();
    }
}
