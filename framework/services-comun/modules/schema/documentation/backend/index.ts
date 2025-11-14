import {SchemaDescriptor} from "../../index";
import {warning} from "../../../utiles/log";
import {IOpenAPI} from "../../../openapi/interface";


export const documentable = (): Function => {
    return function (_target: Object | Function, _propertyKey: string, _descriptor: SchemaDescriptor<any>): void {

        const schema = _descriptor.schema;

        if (!schema) {
            warning(`@documentable used without @schema on method ${_propertyKey}`);
            return;
        }

        const openAPIDoc: IOpenAPI = {
            openapi: "3.1.0",
            info: {
                title: "API Documentation",
                version: "1",
                description: 'Auto-generated API documentation',
            },
            servers: []
        }


        // TODO - Publish in some database on deployment time

    }
}
