import {IPodInfo} from "../../utiles/config";
import {IComponent, IService} from "../common/interface";
import {Monitor} from "./monitor";

export class Component {
    /* STATIC */
    static build(service: IService, config: IPodInfo, name?: string): Component {
        return new this(service, config, name);
    }

    /* INSTANCE */
    private monitors: Monitor[];

    private constructor(private readonly service: IService, private readonly pod: IPodInfo, private readonly _name?: string) {
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
