import {Bulk} from ".";
import {PromiseDelayed} from "../../utiles/promise";
import {BulkBase, type BulkConfig} from "./base";
import type {Elasticsearch} from "..";
import {error} from "../../utiles/log";

export interface BulkAutoConfig extends BulkConfig {
    interval?: number;
}

export class BulkAuto extends BulkBase {
    /* STATIC */

    /* INSTANCE */
    private readonly interval: number;
    private sending: boolean;
    private timer?: NodeJS.Timeout;
    private timeout?: NodeJS.Timeout;
    public get length(): number { return this.operaciones.length; }

    public constructor(elastic: Elasticsearch, {interval=1000, ...config}: BulkAutoConfig = {}) {
        super(elastic, config);
        this.interval = interval;
        this.sending = false;
    }

    public async wait(): Promise<void> {
        this.stop();

        while(this.timeout!=undefined && (this.length>0 || this.sending)) {
            await PromiseDelayed(this.interval);
        }
    }

    public start(): void {
        if (this.timer!=undefined) {
            return;
        }

        if (this.timeout!=undefined) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        this.timer = setInterval(()=>{
            this.send();
        }, this.interval);
    }

    public stop(): void {
        if (this.timer==undefined) {
            return;
        }

        clearInterval(this.timer);
        this.timer = undefined;

        if (this.operaciones.length>0) {
            setImmediate(()=>{
                this.send();
            });
            this.timeout = setTimeout(()=>{
                this.send();
                this.timeout = undefined;
            }, this.interval);
        }
    }

    private send(): void {
        if (this.sending && this.timeout==undefined) {
            return;
        }

        this.sending = true;
        this.sendEjecutar().then(()=>{
            this.sending = false;
        });
    }

    private async sendEjecutar(): Promise<void> {
        if (this.operaciones.length==0) {
            return;
        }

        const bulk = Bulk.init(this.elastic, this.config);
        bulk.add(...this.operaciones.splice(0));
        try {
            await bulk.run();
        } catch (err) {
            error("Error al enviar el bulk", err);
        }
    }
}
