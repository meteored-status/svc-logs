import {PublisherClient} from "@google-cloud/eventarc-publishing";
import {v7 as uuid} from 'uuid';

/**
 * Configuración de sistema para construir y publicar eventos en Eventarc.
 */
export type SystemConfig = {
    /** Nombre completo del message bus de destino. */
    bus?: string;
    /** Identificador de origen del evento (CloudEvents `source`). */
    source?: string;
    /** Generador de IDs personalizado para los eventos publicados. */
    idBuilder?: () => string;
}

/**
 * Parámetros de construcción del publicador.
 */
export type EventarcPublisherBuild = {
    /** Ruta del JSON de credenciales de servicio para GCP. */
    credenciales?: string;
    /** Configuración base aplicada si no se pasa en cada envío. */
    systemConfig?: SystemConfig;
}

/**
 * Publicador de eventos en Eventarc con inicialización lazy del cliente.
 *
 * La configuración de cada envío tiene prioridad sobre la configuración
 * por defecto definida al construir la instancia.
 */
export class EventarcPublisher<T = string> {
    /* STATIC */
    /**
     * Crea una instancia del publicador con credenciales y configuración base.
     *
     * @param params Parámetros opcionales de construcción.
     * @returns Instancia lista para publicar eventos.
     */
    public static build<T>({credenciales = 'files/credenciales/eventarc.json', systemConfig}: EventarcPublisherBuild = {}): EventarcPublisher<T> {
        return new EventarcPublisher<T>(credenciales, systemConfig);
    }

    /* INSTANCE */
    private _client: Promise<PublisherClient>|null = null;
    private _defaultConfig: SystemConfig;
    private constructor(private readonly credenciales: string, config?: SystemConfig) {
        this._defaultConfig = config || {};
    }

    /**
     * Inicializa el cliente de Eventarc una sola vez y reutiliza la promesa.
     */
    private async initClient(): Promise<PublisherClient> {
        if (!this._client) {
            this._client = new Promise<PublisherClient>((resolve) => {
                resolve(new PublisherClient({
                    keyFilename: this.credenciales,
                }));
            });
        }
        return this._client;
    }

    /**
     * Publica un mensaje en el bus de Eventarc como CloudEvent.
     *
     * @param type Tipo de evento.
     * @param json Carga útil del evento (objeto o string JSON).
     * @param config Configuración puntual del envío (sobrescribe la base).
     * @throws Error Si no se define `bus` en config puntual ni en la base.
     * @throws Error Si no se define `source` en config puntual ni en la base.
     */
    public async sendBusMessage(type: T, json: any, config?: SystemConfig): Promise<void> {
        // Se exige bus para evitar publicaciones a destinos ambiguos.
        if (!config?.bus && !this._defaultConfig.bus) {
            throw new Error('Bus not defined');
        }

        // Se exige source para cumplir con el contrato de CloudEvents.
        if (!config?.source && !this._defaultConfig.source) {
            throw new Error('Source not defined');
        }

        let id: string;
        if (config?.idBuilder) {
            id = config.idBuilder();
        } else if (this._defaultConfig.idBuilder) {
            id = this._defaultConfig.idBuilder();
        } else {
            // Fallback seguro para garantizar unicidad en ausencia de generador propio.
            id = uuid();
        }

        const client = await this.initClient();
        await client.publish({
            messageBus: config?.bus || this._defaultConfig.bus || '',
            jsonMessage: JSON.stringify({
                specversion: "1.0",
                type,
                source: config?.source || this._defaultConfig.source || '',
                id,
                time: new Date().toISOString(),
                data: json,
                datacontenttype: typeof json === 'object' ? "application/json" : undefined,
            })
        });
    }
}
