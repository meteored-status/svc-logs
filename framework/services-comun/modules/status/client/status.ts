/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 52de4b5d56a5740ccf20b7a28d6eb859
 * Versión: 2026.6.17+3-josantoniojimnez
 */

import type {IPodInfo} from "@mr/core-workload/config/pod";
import {Component} from "./component";
import {Client} from "./client";

export class Status {
    /* STATIC */
    public static init(service: number, pod: IPodInfo, client: Client): Status {
        return new this(service, pod, client);
    }

    /* INSTANCE */
    private readonly components: Component[];

    private constructor(private readonly service: number, private readonly pod: IPodInfo, private readonly client: Client) {
        this.components = [];
    }

    public addComponent(name?: string): Component {
        const component: Component = Component.build(this.service, this.pod, name);
        this.components.push(component);
        return component;
    }

    public async save(): Promise<Status> {
        await this.client.saveStatus(this.components.map(c => c.toJSON()));
        return this;
    }
}
