import {Duration, PubSub as PubSubBase, Subscription, Topic} from "@google-cloud/pubsub";

import {ETaskCancel, TaskBuilder} from "./task";
import {Mensaje} from "./mensaje";
import {PubSubError, PubSubErrorStep, PubSubErrorTipo} from "./error";
import {info, warning} from "../../utiles/log";
import {PromiseDelayed, PromiseTimeout} from "../../utiles/promise";
// import CPU from "../../utiles/cpu";

declare const PRODUCCION: boolean;
declare const TEST: boolean;

interface IDesuscribirConfig {
    cancelarPendientes: boolean;
    motivo: ETaskCancel;
    mensaje: string;
}

export class PubSub<T> {
    private static DEADLINE = 60;
    private static TIMEOUT = (this.DEADLINE-1)*1000;

    private static _INSTANCE?: PubSubBase;
    protected static get INSTANCE(): PubSubBase {
        return this._INSTANCE ??= new PubSubBase({
            keyFilename: "files/credenciales/pubsub.json",
        });
    }

    protected static async build<T>(): Promise<PubSub<T>> {
        const topic = await this.getTopic();
        const subscription = await this.getSubscription(topic);

        return new this<T>(topic, subscription);
    }

    protected static TOPIC: string = "defecto";
    private static get topicName(): string {
        if (!PRODUCCION) {
            return `${this.TOPIC}-desarrollo`;
        }
        if (TEST) {
            return `${this.TOPIC}-test`;
        }

        return this.TOPIC;
    }

    protected static SUBSCRIPTION?: string;
    private static get subscriptionName(): string {
        const name = this.SUBSCRIPTION ??= this.TOPIC;
        if (!PRODUCCION) {
            return `${name}-desarrollo`;
        }
        if (TEST) {
            return `${name}-test`;
        }

        return name;
    }

    protected static async getTopic(): Promise<Topic> {
        const name = this.topicName;
        const topic = this.INSTANCE.topic(name);

        const [existe] = await topic.exists();
        if (!existe) {
            await topic.create();
            info(`Se ha creado el topic "${name}"`);
        }

        return topic;
    }

    protected static async getSubscription(topic: Topic): Promise<Subscription> {
        const deadline = Duration.from({seconds: this.DEADLINE});

        const subscription: Subscription = topic.subscription(this.subscriptionName, {
            enableOpenTelemetryTracing: true,
            batching: {
                maxMessages: 2500,
            },
            // flowControl: {
            //     allowExcessMessages: false,
            //     maxMessages: this.LIMITE,
            // },
            minAckDeadline: deadline,
            maxAckDeadline: deadline,
        });

        const [existe] = await subscription.exists();
        if (!existe) {
            await subscription.create();
            info(`Se ha creado la suscripción "${this.subscriptionName}"`);
        }

        return subscription;
    }

    /* INSTANCE */
    public get pendientes(): number { return this.activos.size; }

    private activos: Map<Mensaje<T>, boolean>;
    private enabled: boolean;

    protected constructor(private readonly topic: Topic, private readonly subscription: Subscription) {
        this.activos = new Map<Mensaje<T>, boolean>();
        this.enabled = true;

        const interval = setInterval(()=>{
            if (!this.subscription.isOpen) {
                this.enabled = false;
                clearInterval(interval);
            }
        }, 60000)
    }

    public async ok(): Promise<void> {
        if (!this.enabled || !this.subscription.isOpen) {
            return Promise.reject("PubSub desactivado");
        }
    }

    // public async [Symbol.asyncDispose](): Promise<void> {
    //     info("Desuscripción de pubsub de manera automática");
    //     await this.desuscribir({cancelarPendientes: true, motivo: ETaskCancel.SHUTDOWN, mensaje: "Apagado del POD"});
    // }

    public async publicar(data: T): Promise<void> {
        const dataBuffer = Buffer.from(JSON.stringify(data));
        await this.topic.publishMessage({data: dataBuffer});
    }

    public suscribir(taskBuilder: TaskBuilder<T>): void {
        this.subscription.on("message", async (message) => {
            if (!this.enabled) {
            // if (!this.enabled || CPU.cpu > 75) {
                await message.nackWithResponse();
                return;
            }

            const start = Date.now();
            const mensaje: Mensaje<T> = new Mensaje<T>(message, taskBuilder);

            try {

                try {

                    await PromiseDelayed();
                    await mensaje.init();

                } catch (err: any) {

                    await mensaje.error(err);
                    return;

                }

                this.activos.set(mensaje, true);

                try {

                    await PromiseTimeout(mensaje.procesar().catch((err)=>Promise.reject(new PubSubError(PubSubErrorStep.ACEPTADO, PubSubErrorTipo.USER, err))), PubSub.TIMEOUT - (Date.now() - start))
                        .catch((err)=> {
                            if (err instanceof PubSubError) {
                                return Promise.reject(err);
                            }
                            return Promise.reject(new PubSubError(PubSubErrorStep.ACEPTADO, PubSubErrorTipo.TIMEOUT, err));
                        });

                } catch (err: any) {

                    await mensaje.error(err);

                }

                this.activos.delete(mensaje);

            } catch (err) {}
        });
        let error = false;
        this.subscription.on("error", (err) => {
            if (!error) {
                error = true;
                console.error("Error de PubSub", JSON.stringify(err), err, err.code, err.metadata, err.details, JSON.stringify(err));
            }
        });
        this.subscription.on("close", () => {
            if (this.enabled) {
                warning("Se ha cerrado abrúptamente la conexión con PubSub");
            }
        });
    }

    public async desuscribir({cancelarPendientes=false, motivo=ETaskCancel.USUARIO, mensaje=""}: Partial<IDesuscribirConfig> = {}): Promise<void> {
        this.enabled = false;
        await this.subscription.close();

        if (cancelarPendientes) {
            const promesas: Promise<void>[] = [];
            for (const [msg, ] of this.activos.entries()) {
                promesas.push(msg.cancelar(motivo, mensaje)
                    .catch(()=>{})
                    .finally(()=>{
                        this.activos.delete(msg);
                    })
                );
            }
            await Promise.allSettled(promesas);
        }
    }
}
