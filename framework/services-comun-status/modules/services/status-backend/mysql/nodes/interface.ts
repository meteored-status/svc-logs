import {TMySQLNode} from "../index";

export interface INodesIN {
    cluster?: string|string[];
    type?: TMySQLNode|TMySQLNode[];
}

export interface INodesOUT {
    nodes: INode[];
}

export interface INode {
    name: string;
    cluster: string;
    node_type: TMySQLNode;
}
