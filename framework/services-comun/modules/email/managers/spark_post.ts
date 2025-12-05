import {IHTMLInlineContent, IMail, IMailManager, ITemplateContent, ITextInlineContent, TContentTypes} from "../manager";
import {readJSON} from "../../utiles/fs";

import SparkPost from "sparkpost";

export interface ICredenciales {
    api_key: string;
    endpoint?: string;
}

interface ISendResult {
    results: {
        total_rejected_recipients: number;
        total_accepted_recipients: number;
        id: string;
    }
}

export class SparkPostManager implements IMailManager {
    /* INSTANCE */
    private readonly credentials: Promise<ICredenciales>;

    public constructor(credentials?: ICredenciales) {
        this.credentials = credentials ? Promise.resolve(credentials) : readJSON<ICredenciales>("files/credenciales/sparkpost.json");
    }

    private async getClient(): Promise<SparkPost> {
        const result = await this.credentials;
        return new SparkPost(result.api_key, {
            endpoint: result.endpoint,
        });
    }

    public async deleteSuppression(email: string): Promise<void> {
        const client = await this.getClient();

        await client.suppressionList.delete(email);
    }

    public async send(data: IMail): Promise<ISendResult> {
        // Creamos la estructura de datos de la transmisión con los datos base
        const data_transmission: SparkPost.CreateTransmission = {
            options: {
                ...data.options??{},
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

            const htmlContent: IHTMLInlineContent|undefined = html ? html as IHTMLInlineContent : undefined;
            const textContent: ITextInlineContent|undefined = text ? text as ITextInlineContent : undefined;

            data_transmission.content = {
                ...data_transmission.content,
                html: htmlContent?.value,
                text: textContent?.value,
                attachments: data.attachments // EN el template no se pueden enviar attachments.
            };
        }

        const client = await this.getClient();

        // Enviamos la transmisión
        return await client.transmissions.send(data_transmission);
    }

}
