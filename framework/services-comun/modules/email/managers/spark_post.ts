/**
 * Editor: David Martínez Moya
 * Fecha: Wed, 27 May 2026 06:41:12 GMT
 * Hash: f3026b32b27dce5756f510f6e42f90cd
 * Versión: 2026.5.27+2-davidmartinezmoya
 * Anterior: 2026.5.27+1-davidmartinezmoya
 */

import {
    IActor,
    IHTMLInlineContent,
    IMail,
    IMailManager,
    ITemplateContent,
    ITextInlineContent,
    TContentTypes
} from "../manager";
import {readJSON} from "../../utiles/fs";

import SparkPost from "sparkpost";

/**
 * Opciones de construccion del manager de SparkPost.
 */
type SparkPostBuild = {
    /** Ruta al fichero de credenciales JSON. */
    credenciales?: string;
}

/**
 * Credenciales de acceso para un cliente SparkPost.
 */
type SparkPostAPI = {
    /** API key del cliente SparkPost. */
    api_key: string;
    /** Endpoint opcional para entornos personalizados. */
    endpoint?: string;
}

/**
 * Configuracion completa de SparkPost con cliente normal y opcionalmente admin.
 */
type SparkPostConfig = {
    /** Credenciales del cliente de envio estandar. */
    client: SparkPostAPI;
    /** Credenciales del cliente administrador (listas, envios por lista, etc.). */
    admin?: SparkPostAPI;
}

/**
 * Resultado simplificado de una transmision de SparkPost.
 */
interface ISendResult {
    results: {
        /** Numero de destinatarios rechazados. */
        total_rejected_recipients: number;
        /** Numero de destinatarios aceptados. */
        total_accepted_recipients: number;
        /** Identificador de la transmision. */
        id: string;
    }
}

/**
 * Implementacion de `IMailManager` basada en SparkPost.
 *
 * Gestiona dos clientes lazy:
 * - cliente normal para envios directos,
 * - cliente admin para operaciones de listas y envios por lista.
 */
export class SparkPostManager implements IMailManager {
    /* STATIC */
    /**
     * Construye una instancia del manager leyendo credenciales desde disco.
     *
     * Soporta dos formatos de fichero:
     * - credenciales simples (`SparkPostAPI`),
     * - configuracion con `client` y `admin` (`SparkPostConfig`).
     *
     * @param param0 Opciones de inicializacion.
     * @returns Instancia lista para operar con SparkPost.
     */
    public static async build({credenciales = 'files/credenciales/sparkpost.json'}: SparkPostBuild = {}): Promise<SparkPostManager> {
        const config = await readJSON<SparkPostAPI | SparkPostConfig>(credenciales);

        if ('client' in config) {
            return new SparkPostManager(config.client, config.admin);
        } else {
            return new SparkPostManager(config);
        }
    }

    /* INSTANCE */
    /** Cliente principal inicializado de forma lazy. */
    private client: Promise<SparkPost> | undefined;
    /** Cliente administrador inicializado de forma lazy. */
    private adminClient: Promise<SparkPost> | undefined;

    /** Credenciales del cliente principal. */
    private readonly clientCredentials: SparkPostAPI;
    /** Credenciales opcionales del cliente administrador. */
    private readonly adminClientCredentials?: SparkPostAPI;

    /**
     * Crea el manager con las credenciales necesarias.
     *
     * @param credentials Credenciales del cliente principal.
     * @param adminCredentials Credenciales opcionales para cliente admin.
     */
    public constructor(credentials: SparkPostAPI, adminCredentials?: SparkPostAPI) {
        this.clientCredentials = credentials;
        this.adminClientCredentials = adminCredentials;
    }

    /**
     * Recupera (o inicializa) el cliente principal.
     *
     * @returns Cliente SparkPost principal cacheado.
     */
    private async getClient(): Promise<SparkPost> {
        if (!this.client) {
            this.client = Promise.resolve(new SparkPost(this.clientCredentials.api_key, {
                endpoint: this.clientCredentials.endpoint,
            }));
        }
        return this.client;
    }

    /**
     * Recupera (o inicializa) el cliente administrador.
     *
     * @returns Cliente SparkPost admin cacheado.
     * @throws Error Si no se configuraron credenciales de administrador.
     */
    private async getAdminClient(): Promise<SparkPost> {
        if (!this.adminClient) {
            if (!this.adminClientCredentials) {
                throw new Error('Admin credentials not provided');
            }
            this.adminClient = Promise.resolve(new SparkPost(this.adminClientCredentials.api_key, {
                endpoint: this.adminClientCredentials.endpoint,
            }));
        }
        return this.adminClient;
    }

    /**
     * Elimina un email de la lista de supresion del proveedor.
     *
     * @param email Email a eliminar de la suppression list.
     */
    public async deleteSuppression(email: string): Promise<void> {
        const client = await this.getClient();

        await client.suppressionList.delete(email);
    }

    /**
     * Crea una lista de destinatarios en SparkPost.
     *
     * @param name Identificador y nombre de la lista.
     * @param recipients Destinatarios iniciales.
     */
    public async createRecipientList(name: string, recipients: IActor[]): Promise<void> {
        const client = await this.getAdminClient();
        await client.recipientLists.create({
            id: name,
            name: name,
            recipients: recipients.map(recipient => ({
                address: {
                    email: recipient.email,
                    name: recipient.name,
                },
                substitution_data: recipient.substitution_data,
            })),
        });
    }

    /**
     * Añade destinatarios a una lista existente.
     *
     * @param listId Identificador de la lista.
     * @param recipients Destinatarios a agregar.
     */
    public async addRecipientsToList(listId: string, recipients: IActor[]): Promise<void> {
        const client = await this.getAdminClient();

        await client.recipientLists.update(listId, {
            recipients: recipients.map(recipient => ({
                address: {
                    email: recipient.email,
                    name: recipient.name,
                },
                substitution_data: recipient.substitution_data,
            })),
        });
    }

    /**
     * Obtiene una lista de destinatarios junto a sus miembros.
     *
     * @param listId Identificador de la lista.
     * @returns Resultado de SparkPost con la lista y sus destinatarios.
     */
    public async getRecipientList(listId: string): Promise<{ results: SparkPost.RecipientListWithRecipients }> {
        const client = await this.getAdminClient();

        return await client.recipientLists.get(listId);
    }

    /**
     * Envia una transmision a todos los destinatarios de una lista.
     *
     * @param listId Identificador de la lista de destinatarios.
     * @param data Datos del email a enviar.
     * @returns Resultado de la transmision en SparkPost.
     */
    public async sendToList(listId: string, data: IMail): Promise<ISendResult> {

        const data_transmission: SparkPost.CreateTransmission = {
            options: {
                ...data.options ?? {},
                start_time: data.delivery,
            },
            campaign_id: data.campaign,
            content: {
                from: data.from ? (
                    data.from.name ? {
                        email: data.from?.email,
                        name: data.from?.name,
                    } : data.from.email
                ) : undefined,
                subject: data.subject,
                reply_to: data.reply_to
            },
            recipients: {
                list_id: listId,
            },
        };

        // Si hay plantilla sólo usamos sus datos (no se añade otro contenido)
        const template = data.contents.find(content => content.type === TContentTypes.TEMPLATE);
        if (template) {
            const content: ITemplateContent<any> = template as ITemplateContent<any>;
            data_transmission.content = {
                ...data_transmission.content,
                template_id: content.name,
            };
            data_transmission.substitution_data = content.value;
        } else {
            const html = data.contents.find(content => content.type === TContentTypes.HTML);
            const text = data.contents.find(content => content.type === TContentTypes.TEXT);

            const htmlContent: IHTMLInlineContent | undefined = html ? html as IHTMLInlineContent : undefined;
            const textContent: ITextInlineContent | undefined = text ? text as ITextInlineContent : undefined;

            data_transmission.content = {
                ...data_transmission.content,
                html: htmlContent?.value,
                text: textContent?.value,
                attachments: data.attachments // EN el template no se pueden enviar attachments.
            };
        }

        const client = await this.getAdminClient();

        // Enviamos la transmisión
        return await client.transmissions.send(data_transmission);
    }

    /**
     * Envia un email de forma directa a una lista explicita de destinatarios.
     *
     * @param data Datos del email a enviar.
     * @returns Resultado de la transmision en SparkPost.
     */
    public async send(data: IMail): Promise<ISendResult> {
        // Creamos la estructura de datos de la transmisión con los datos base
        const data_transmission: SparkPost.CreateTransmission = {
            options: {
                ...data.options ?? {},
                start_time: data.delivery,
            },
            campaign_id: data.campaign,
            content: {
                from: data.from ? (
                    data.from.name ? {
                        email: data.from?.email,
                        name: data.from?.name,
                    } : data.from.email
                ) : undefined,
                subject: data.subject,
                reply_to: data.reply_to
            },
            recipients: data.to.map((to) => {
                return {
                    address: {
                        email: to.email,
                        name: to.name,
                    },
                    substitution_data: to.substitution_data,
                };
            })
        }

        // Si hay plantilla sólo usamos sus datos (no se añade otro contenido)
        const template = data.contents.find(content => content.type === TContentTypes.TEMPLATE);
        if (template) {
            const content: ITemplateContent<any> = template as ITemplateContent<any>;
            data_transmission.content = {
                ...data_transmission.content,
                template_id: content.name,
            };
            data_transmission.substitution_data = content.value;
        } else {
            const html = data.contents.find(content => content.type === TContentTypes.HTML);
            const text = data.contents.find(content => content.type === TContentTypes.TEXT);

            const htmlContent: IHTMLInlineContent | undefined = html ? html as IHTMLInlineContent : undefined;
            const textContent: ITextInlineContent | undefined = text ? text as ITextInlineContent : undefined;

            data_transmission.content = {
                ...data_transmission.content,
                html: htmlContent?.value,
                text: textContent?.value,
                attachments: data.attachments // EN el template no se pueden enviar attachments.
            };
        }

        const client = await this.getClient();

        try {
            // Enviamos la transmisión
            return await client.transmissions.send(data_transmission);
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Recupera todas las listas de destinatarios disponibles en SparkPost.
     *
     * @returns Resultado paginado de listas devuelto por SparkPost.
     */
    public async getAllRecipientLists(): Promise<{ results: SparkPost.RecipientList[] }> {
        const client = await this.getAdminClient();

        return await client.recipientLists.list();
    }

    /**
     * Elimina una lista de destinatarios en SparkPost.
     *
     * @param listId Identificador de la lista a eliminar.
     */
    public async deleteRecipientList(listId: string) {
        const client = await this.getAdminClient();

        await client.recipientLists.delete(listId);
    }
}
