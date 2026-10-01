/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 8730acfad72a73ce0189e400d5ac6f59
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.6.17+3-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IPodInfo} from "@mr/core-workload/config/pod";

import type {IComponent} from "../common/interface";
import type {Monitor} from "./monitor";

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
