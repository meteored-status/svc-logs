import {TElasticNode} from "../index";

export interface ISearchIN {
    interval?: string;
    cluster?: string|string[];
    node?: string|string[];
    start?: string;
    end?: string;
}

export interface ISearchOUT {
    clusters: ICluster[];
}

export interface ICluster {
    name: string;
    nodes: INode[];
}

export interface INode {
    name: string;
    type:TElasticNode;
    monitors: IMonitor[];
}

export interface IMonitor {
    date: number;
    cpu: {
        percent: number;
    },
    memory: {
        total: number;
        used: number;
        percent: number;
    },
    jvm: {
        total: number;
        used: number;
        percent: number;
    },
    write_queue: {
        size: number;
    }
}
