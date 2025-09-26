import {TElasticNode} from "../index";

export interface INodesIN {
    cluster?: string|string[];
    type?: TElasticNode|TElasticNode[];
}

export interface INodesOUT {
    nodes: INode[];
}

export interface INode {
    name: string;
    cluster: string;
    node_type: TElasticNode;
}
