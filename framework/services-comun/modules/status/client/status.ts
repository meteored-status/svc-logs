/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: d6a091f996445b523ed1d06a6d1a2172
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.6.17+3-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IPodInfo} from "@mr/core-workload/config/pod";

import {Component} from "./component";
import type {Client} from "./client";

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
