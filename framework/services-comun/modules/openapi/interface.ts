export interface IOpenAPI {
    openapi: "3.1.0";
    info: IInfo;
    servers: IServer[];
    paths?: IPaths;
    components?: IComponents;
    tags?: ITag[];
}

export interface IInfo {
    title: string;
    description: string;
    version: "1";
}

export interface IServer {
    url: string;
}

export interface IPaths {
    [path: string]: IPath;
}

export interface IPath {
    get?: IGet;
}

export interface IComponents {
    schemas?: ISchemas;
    examples?: IExamples;
}

export interface IExamples {
    [name: string]: IExample;
}

export interface ISchemas {
    [name: string]: ISchema;
}

export interface IHTTPMethod {
    tags?: string[];
}

export interface IGet extends IHTTPMethod {
    description: string;
    parameters?: IParameter[];
    responses?: IResponses;
}

export interface IParameter {
    name: string;
    in: "header"|"path"|"query"|"cookie";
    description?: string;
    required?: boolean;
    schema?: ISchema;
}

export interface ISchema {
    type?: string;
    properties?: IProperties;
    oneOf?: ISchema[];
    $ref?: string;
    required?: string[];
}

export interface IProperties {
    [name: string]: IProperty;
}

export interface IProperty {
    type: string;
    description?: string;
    format?: string;
    items?: IItems;
    properties?: IProperties;
    examples?: any[];
    required?: string[];
}

export interface IExample {
    value?: any;
    summary?: string;
    description?: string;
    externalValue?: string;
    $ref?: string;
}

export interface IItems {
    type?: string;
    format?: string;
    items?: IItems;
    properties?: IProperties;
    $ref?: string;
}

export interface IResponses {
    [code: number]: IResponse;
}

export interface IResponse {
    description: string;
    content?: IContent;
}

export interface IContent {
    [type: string]: IMediaType;
}

export interface IMediaType {
    schema: ISchema;
    examples?: IExamples;
}

export interface ITag {
    name: string;
    description?: string;
}
