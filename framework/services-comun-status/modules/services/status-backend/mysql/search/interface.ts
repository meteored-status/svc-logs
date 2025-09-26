import {TMySQLNode} from "../index";

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
    type:TMySQLNode;
    monitors: IMonitor[];
}

export interface IMonitor {
    date: number;
    lag: number;
}
