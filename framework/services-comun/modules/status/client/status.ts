import ServiceMap, {IServiceInfo, TService} from "../config";
import {IPodInfo} from "../../utiles/config";
import {Component} from "./component";
import {Client} from "./client";
import {IService} from "../common/interface";

export class Status {
    /* STATIC */
    public static init(service: TService, pod: IPodInfo, client: Client): Status {
        return new this(service, pod, client);
    }

    /* INSTANCE */
    private readonly components: Component[];

    private constructor(private readonly type: TService, private readonly pod: IPodInfo, private readonly client: Client) {
        this.components = [];
    }

    public addComponent(name?: string): Component {
        const component: Component = Component.build(this.toService(), this.pod, name);
        this.components.push(component);
        return component;
    }

    public async save(): Promise<Status> {
        await this.client.saveStatus(this.components.map(c => c.toJSON()));
        return this;
    }

    private toService(): IService {
        const info: IServiceInfo = ServiceMap.getService(this.type) as IServiceInfo;
        return {
            id: this.type,
            name: info.name,
            project_name: info.project,
            namespace: info.namespace,
        };
    }
}
