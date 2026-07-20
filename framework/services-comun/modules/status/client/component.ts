/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: da19c6f698edd816fc919b12eb7edcf6
 * Versión: 2026.6.17+3-josantoniojimnez
 */

import type {IPodInfo} from "@mr/core-workload/config/pod";

import type {IComponent} from "../common/interface";
import {Monitor} from "./monitor";

export class Component {
    /* STATIC */
    static build(service: number, config: IPodInfo, name?: string): Component {
        return new this(service, config, name);
    }

    /* INSTANCE */
    private monitors: Monitor[];

    private constructor(private readonly service: number, private readonly pod: IPodInfo, private readonly _name?: string) {
        this.monitors = [];
    }

    public addMonitor(monitor: Monitor): void {
        this.monitors.push(monitor);
    }

    public toJSON(): IComponent {
        return {
            name: this._name??this.pod.servicio,
            service: this.service,
            monitors: this.monitors.map(m => m.toJSON()),
            updated: new Date()
        };
    }
}
