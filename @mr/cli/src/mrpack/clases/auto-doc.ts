import ts from "typescript";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {isDir, readDir} from "services-comun/modules/utiles/fs";
import {
    IHTTPMethod,
    IItems,
    IOpenAPI,
    IParameter,
    IPath,
    ISchema
} from "services-comun/modules/openapi/interface";
import {ManifestWorkspaceLoader} from "./manifest/workspace";
import {Manifest} from "../../../manifest/workspace";
import {MySQL} from "services-comun/modules/database/mysql";

type Component = {
    name: string;
    endpoints: Endpoint[];
}

type Endpoint = {
    path: string;
    method: string;
    querySchema?: any;
    postSchema?: any;
    responseSchema?: any;
    headerSchema?: any;
}

type Service = {
    name: string;
}

export interface IConfigEjecucion {
    env: string;
}

export class AutoDoc {
    /* STATIC */
    private static EXCLUDED_ROUTE_GROUPS = [
        'RouteGroupError',
        'Admin',
        'Favicon',
    ];

    public static run(basedir: string, config: IConfigEjecucion): void {
        PromiseDelayed()
            .then(async ()=>{
                const services: string[] = [];
                if (await isDir(`${basedir}/services/`)) {
                    services.push(...await readDir(`${basedir}/services/`));
                }

                const docs: IOpenAPI[] = await Promise.all(services.map(async service => {
                    const {manifest} = await new ManifestWorkspaceLoader(`${basedir}/services/${service}`).load();
                    return this.docService(basedir, service, manifest);
                })).then(docs => docs.flat());

                await this.save(docs, config.env);
            })
            .catch((err)=>{
                if (err!=undefined) {
                    console.error(err);
                }
            })
        ;
    }

    private static async save(docs: IOpenAPI[], env: string): Promise<void> {
        const db = MySQL.build({
            credenciales: `kustomizar/tmp/credenciales/mysql-services-socket-${env}.json`,
            database: 'doc'
        });

        await db.bulkInsert(docs.map(doc => {
            return {
                query: 'insert into openapi (service, doc) values (?, ?)',
                params: [doc.info.title, JSON.stringify(doc)],
                table: 'openapi',
                duplicate: ['doc']
            }
        }));

        await db.close();
    }

    private static docService(basedir: string, service: string, manifest: Manifest): IOpenAPI[] {
        const program = ts.createProgram([`${basedir}/services/${service}/main.ts`], {
            target: ts.ScriptTarget.ES2024,
            module: ts.ModuleKind.NodeNext
        });

        const typeChecker = program.getTypeChecker();

        const components: Component[] = [];

        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) {
                continue;
            }

            ts.forEachChild(sourceFile, (node) => {
                if (ts.isClassDeclaration(node) && node.name) {
                    // Coprobar si la clase extiende RouteGroup
                    const heritageClauses = node.heritageClauses;
                    if (!heritageClauses) {
                        return;
                    }

                    const extendsRouteGroup = heritageClauses.some((clause) => {
                        return clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.some((type) => {
                            const typeSymbol = typeChecker.getSymbolAtLocation(type.expression);
                            return typeSymbol?.getName() === 'RouteGroup';
                        });
                    });

                    if (!extendsRouteGroup) {
                        return;
                    }

                    const className = node.name.text;
                    if (AutoDoc.EXCLUDED_ROUTE_GROUPS.includes(className)) {
                        return;
                    }

                    const component: Component = {
                        name: className,
                        endpoints: [],
                    };
                    components.push(component);

                    // Recuperamos el metodo "getHandlers"
                    const getHandlersMethod = node.members.find((member) => {
                        return ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name) && member.name.text === 'getHandlers';
                    }) as ts.MethodDeclaration | undefined;

                    if (!getHandlersMethod) {
                        return;
                    }

                    // Ese metodo devuelve un array de handlers
                    const returnStatement = getHandlersMethod.body?.statements.find((stmt) => ts.isReturnStatement(stmt)) as ts.ReturnStatement | undefined;
                    if (!returnStatement || !returnStatement.expression || !ts.isArrayLiteralExpression(returnStatement.expression)) {
                        return;
                    }

                    const handlersArray = returnStatement.expression as ts.ArrayLiteralExpression;
                    handlersArray.elements.forEach((element) => {
                        // Cada elemento (handler) es un objeto con la propiedad "expresiones"
                        if (ts.isObjectLiteralExpression(element)) {
                            const expresionesProperty = element.properties.find((prop) => {
                                return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'expresiones';
                            }) as ts.PropertyAssignment | undefined;

                            if (!expresionesProperty || !ts.isArrayLiteralExpression(expresionesProperty.initializer)) {
                                return;
                            }

                            const expresionesArray = expresionesProperty.initializer as ts.ArrayLiteralExpression;
                            // Por cada expresión extraemos los datos necesarios
                            expresionesArray.elements.forEach((expresionElement) => {
                                if (ts.isObjectLiteralExpression(expresionElement)) {
                                    // Extraer los métodos HTTP
                                    const metodoProperty = expresionElement.properties.find((prop) => {
                                        return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'metodos';
                                    }) as ts.PropertyAssignment | undefined;
                                    let metodos: string[] = [];
                                    if (metodoProperty && ts.isArrayLiteralExpression(metodoProperty.initializer)) {
                                        metodos = metodoProperty.initializer.elements
                                            .filter(ts.isStringLiteral)
                                            .map(lit => lit.text);
                                    }

                                    // Extraer el campo resumen
                                    const resumenProperty = expresionElement.properties.find((prop) => {
                                        return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'resumen';
                                    }) as ts.PropertyAssignment | undefined;
                                    let resumen = '';
                                    if (resumenProperty && ts.isStringLiteral(resumenProperty.initializer)) {
                                        resumen = resumenProperty.initializer.text;
                                    }

                                    // Extraer el campo "query"
                                    const queryProperty = expresionElement.properties.find((prop) => {
                                        return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'query';
                                    }) as ts.PropertyAssignment | undefined;

                                    let queryJSON: any = undefined;
                                    if (queryProperty) {
                                        queryJSON = this.tsToJSON(queryProperty.initializer, typeChecker);
                                    }

                                    // Extraer el campo "post"
                                    const postProperty = expresionElement.properties.find((prop) => {
                                        return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'post';
                                    }) as ts.PropertyAssignment | undefined;

                                    let postJSON: any = undefined;
                                    if (postProperty) {
                                        postJSON = this.tsToJSON(postProperty.initializer, typeChecker);
                                    }

                                    // Extraer el campo "response"
                                    const responseProperty = expresionElement.properties.find((prop) => {
                                        return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'response';
                                    }) as ts.PropertyAssignment | undefined;

                                    let responseJSON: any = undefined;
                                    if (responseProperty) {
                                        responseJSON = this.tsToJSON(responseProperty.initializer, typeChecker);
                                    }

                                    let headersJSON: any = undefined;
                                    const headersProperty = expresionElement.properties.find((prop) => {
                                        return ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'headers';
                                    }) as ts.PropertyAssignment | undefined;

                                    if (headersProperty) {
                                        headersJSON = this.tsToJSON(headersProperty.initializer, typeChecker);
                                    }

                                    // Añadir cada metodo como un endpoint separado

                                    metodos.forEach(metodo => {
                                        component.endpoints.push({
                                            method: metodo.toLowerCase(),
                                            path: resumen,
                                            querySchema: queryJSON,
                                            postSchema: postJSON,
                                            responseSchema: responseJSON,
                                            headerSchema: headersJSON,
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        const services: Service[] = manifest.deploy.kustomize?.map(kustomizeEntry => {
            return {
                name: kustomizeEntry.name,
            }
        })??[
            {
                name: service,
            }
        ];

        return services.map(serviceItem => this.buildOpenAPI(components, serviceItem));
    }

    private static tsToJSON(node: ts.Node, typeChecker: ts.TypeChecker): any {
        if (ts.isObjectLiteralExpression(node)) {
            const obj: any = {};
            node.properties.forEach(prop => {
                if (ts.isPropertyAssignment(prop)) {
                    let key: string|undefined = undefined;
                    if (ts.isIdentifier(prop.name)) {
                        key = prop.name.text;
                    } else if (ts.isStringLiteral(prop.name)) {
                        key = prop.name.text;
                    }

                    if (key) {
                        obj[key] = this.tsToJSON(prop.initializer, typeChecker);
                    }
                } else if (ts.isSpreadAssignment(prop)) {
                    const spreadValue = this.tsToJSON(prop.expression, typeChecker);

                    if (spreadValue && typeof spreadValue === 'object') {
                        Object.assign(obj, spreadValue);
                    }
                } else if (ts.isShorthandPropertyAssignment(prop)) {
                    obj[prop.name.text] = this.tsToJSON(prop.name, typeChecker);
                }
            });
            return obj;
        } else if (ts.isCallExpression(node)) {
            // Sólo funciona para funciones wrapper
            const arg = node.arguments[0];
            if (arg) {
                return this.tsToJSON(arg, typeChecker);
            }
            return null;
        } else if (ts.isArrayLiteralExpression(node)) {
            return node.elements.map(element => this.tsToJSON(element, typeChecker));
        } else if (ts.isStringLiteral(node)) {
            return node.text;
        } else if (ts.isNumericLiteral(node)) {
            return Number(node.text);
        } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
            return true;
        } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
            return false;
        } else if (ts.isRegularExpressionLiteral(node)) {
            return node.text;
        } else if (ts.isIdentifier(node)) {
            return this.resolveIdentifier(node, typeChecker);
        }
        return null;
    }

    /**
     * Busca la definición de una variable y procesa su valor inicial
     */
    private static resolveIdentifier(node: ts.Identifier, typeChecker: ts.TypeChecker): any {
        let symbol = typeChecker.getSymbolAtLocation(node);

        // Si es un import (alias), saltamos al símbolo original
        if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
            symbol = typeChecker.getAliasedSymbol(symbol);
        }

        if (symbol && symbol.valueDeclaration) {
            // Verificamos que sea una variable con un valor inicial
            if (ts.isVariableDeclaration(symbol.valueDeclaration) && symbol.valueDeclaration.initializer) {
                // RECURSIVIDAD: Volvemos a llamar a tsToJSON con el valor de la variable
                return this.tsToJSON(symbol.valueDeclaration.initializer, typeChecker);
            }
        }

        return null; // No se pudo resolver el valor estáticamente
    }

    private static buildOpenAPI(components: Component[], service: Service): IOpenAPI {
        const doc: IOpenAPI = {
            openapi: "3.1.0",
            info: {
                title: service.name,
                version: "1",
                description: "Documentación automática de la API"
            },
            servers: [],
            paths: {},
            tags: []
        }

        components.forEach(component => {
            const tag = {
                name: component.name,
                description: `Endpoints for ${component.name}`
            };
            doc.tags?.push(tag);

            component.endpoints.forEach(endpoint => {
                const path: IPath = {};
                let pathMethod: IHTTPMethod = {};

                // Añadir parámetros de query si existen
                if (endpoint.querySchema) {
                    (pathMethod.parameters??=[]).push(...this.buildParameters(endpoint.querySchema, 'query'));
                }

                if (endpoint.headerSchema) {
                    (pathMethod.parameters??=[]).push(...this.buildParameters(endpoint.headerSchema, 'header'));
                }

                if (endpoint.responseSchema) {
                    const schema: ISchema = this.buildSchemaFromResponseObject(endpoint.responseSchema);

                    pathMethod.responses = {
                        "200": {
                            description: "Successful Response",
                            content: {
                                "application/json": {
                                    schema
                                }
                            }
                        }
                    };
                }


                if (endpoint.method === 'get') {
                    path.get = {
                        ...pathMethod,
                        description: `Auto-generated GET endpoint for ${endpoint.path}`,
                        tags: [component.name]
                    };
                } else if (endpoint.method === 'post') {
                    path.post = {
                        ...pathMethod,
                        description: `Auto-generated POST endpoint for ${endpoint.path}`,
                        tags: [component.name]
                    };

                    // Añadir requestBody para POST si existe
                    if (endpoint.postSchema && endpoint.method === 'post') {
                        const schema: ISchema = {};
                        schema.type = "object";
                        schema.properties = {};
                        schema.required = [];

                        Object.keys(endpoint.postSchema).forEach(propName => {
                            schema.properties![propName] = {
                                type: typeof endpoint.postSchema[propName].regex === 'string' ? 'string' : endpoint.postSchema[propName].type, // Simplificación
                                description: endpoint.postSchema[propName].description || '',
                            };
                            if (endpoint.postSchema[propName].required) {
                                schema.required!.push(propName);
                            }
                        });


                        path.post.requestBody = {
                            content: {
                                "application/json": {
                                    schema
                                }
                            }
                        }
                    }
                }

                doc.paths![endpoint.path] = path;

            });
        });

        return doc;
    }

    private static buildParameters(spec: any, type: 'query'|'header'): IParameter[] {
        return Object.keys(spec).map(paramName => {
            const paramSpec = spec[paramName];
            return {
                name: paramName,
                in: type,
                required: !paramSpec.opcional,
                schema: {
                    type: typeof paramSpec.regex === 'string' ? 'string' : paramSpec.type // Simplificación
                },
                description: paramSpec.description || ''
            };
        });
    }

    private static buildSchemaFromResponseObject(spec: any): ISchema {
        const schema: ISchema = {};
        schema.type = "object";
        schema.properties = {};
        schema.required = [];

        Object.keys(spec).forEach(propName => {
            const propSpec = spec[propName];
            const propType = propSpec.type;

            switch (propType) {
                case 'array':
                    schema.properties![propName] = {
                        type: 'array',
                        description: propSpec.description,
                        items: this.buildSchemaFromResponseObject({
                            items: {
                                ...propSpec.items
                            }
                        }).properties!['items'] as IItems,
                    }
                    break;
                case 'object':
                    schema.properties![propName] = {
                        type: 'object',
                        description: propSpec.description,
                        properties: {},
                    }
                    const newObject = this.buildSchemaFromResponseObject(propSpec.properties);
                    schema.properties![propName].properties = newObject.properties;
                    schema.properties![propName].required = newObject.required;
                    break;
                default:
                    schema.properties![propName] = {
                        type: propType,
                        description: propSpec.description || '',
                    };
                    break;
            }

            if (propSpec.required) {
                schema.required!.push(propName);
            }
        });

        return schema;
    }
}
