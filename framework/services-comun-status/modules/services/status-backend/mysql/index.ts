import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {ISearchOUT} from "./search/interface";
import {IClusterListOUT} from "./cluster-list/interface";
import {logRejection} from "services-comun/modules/decorators/metodo";
import {INodesOUT} from "./nodes/interface";

export type TMySQLNode = "master" | "slave";

export class MySQL extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async search(token: string, interval?: string, clusters?: string[], nodes?: string[], range?: {start: number; end: number;}): Promise<RequestResponse<ISearchOUT>> {
        let url = `${this.SERVICIO}/backend/mysql-monitor/search`;

        const params: string[] = [];

        if (interval) {
            params.push(`interval=${interval}`);
        }

        clusters?.forEach(cluster => {
            params.push(`cluster=${cluster}`);
        });

        nodes?.forEach(node => {
            params.push(`node=${node}`);
        });

        if (range && range.start && range.end) {
            params.push(`start=${range.start}`);
            params.push(`end=${range.end}`);
        }

        if (params.length) {
            url += `?${params.join("&")}`;
        }

        return this.get<ISearchOUT>(url, {auth: token});
    }

    @logRejection(true)
    public static async listClusters(token: string): Promise<RequestResponse<IClusterListOUT>> {
        const url = `${this.SERVICIO}/backend/mysql-monitor/cluster/list`;
        return this.get<IClusterListOUT>(url, {auth: token});
    }

    @logRejection(true)
    public static async searchNodes(token: string, clusters?: string[], types?: TMySQLNode[]): Promise<RequestResponse<INodesOUT>> {
        let url = `${this.SERVICIO}/backend/mysql-monitor/nodes`;

        if (clusters?.length) {
            url += `?clusters=${clusters.join(",")}`;
        }

        if (types?.length) {
            url += `&types=${types.join(",")}`;
        }

        return this.get<INodesOUT>(url, {auth: token});
    }

}
