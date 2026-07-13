/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 19c6461daeb348a54b09ed7bb6ef788a
 */

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
import type {Manifest} from "@mr/core-dev/manifest";
import {MySQL} from "services-comun/modules/database/mysql";

import {Log} from "./log";
import {ManifestWorkspaceLoader} from "./manifest/workspace";

/** Valor JSON genérico devuelto por la conversión de literales AST de TypeScript a JSON. */
type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};

/**
 * Definición de un campo de esquema de validación (`query`/`post`/`headers`/`response`),
 * tal y como se declaran en los `RouteGroup` de `services-comun` (p.ej. `{type: "string", regex: ...}`).
 * Se obtiene interpretando el AST de TypeScript, por lo que su forma no está garantizada en
 * tiempo de compilación; se asume de confianza por convención del proyecto.
 */
interface IEsquemaCampo {
    type?: string;
    regex?: string;
    opcional?: boolean;
    required?: boolean;
    description?: string;
    items?: IEsquemaCampo;
    properties?: IEsquema;
}

type IEsquema = Record<string, IEsquemaCampo>;

type Component = {
    name: string;
    endpoints: Endpoint[];
}

type Endpoint = {
    path: string;
    method: string;
    querySchema?: IEsquema;
    postSchema?: IEsquema;
    responseSchema?: IEsquema;
    headerSchema?: IEsquema;
}

type Service = {
    name: string;
}

export interface IConfigEjecucion {
    env: string;
}

const EXCLUDED_ROUTE_GROUPS = [
    "RouteGroupError",
    "Admin",
    "Favicon",
];

export function run(basedir: string, config: IConfigEjecucion): void {
    PromiseDelayed()
        .then(async ()=>{
            const services: string[] = [];
            if (await isDir(`${basedir}/services/`)) {
                services.push(...await readDir(`${basedir}/services/`));
            }

            const docs: IOpenAPI[] = await Promise.all(services.map(async service => {
                const {manifest} = await new ManifestWorkspaceLoader(`${basedir}/services/${service}`).load();
                return docService(basedir, service, manifest);
            })).then(docs => docs.flat());

            await save(docs, config.env);
        })
        .catch((err)=>{
            if (err!=undefined) {
                Log.error({type: Log.label_base, label: "autodoc"}, "Error generando la documentación", err);
            }
        });
}

async function save(docs: IOpenAPI[], env: string): Promise<void> {
    const db = MySQL.build({
        credenciales: `kustomizar/tmp/credenciales/mysql-services-socket-${env}.json`,
        database: "doc"
    });

    await db.bulkInsert(docs.map(doc => {
        return {
            query: "insert into openapi (service, doc) values (?, ?)",
            params: [doc.info.title, JSON.stringify(doc)],
            table: "openapi",
            duplicate: ["doc"]
        }
    }));

    await db.close();
}

function docService(basedir: string, service: string, manifest: Manifest): IOpenAPI[] {
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
            if (!ts.isClassDeclaration(node) || !node.name) {
                return;
            }

            const heritageClauses = node.heritageClauses;
            if (!heritageClauses) {
                return;
            }

            const extendsRouteGroup = heritageClauses.some((clause) =>
                clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.some((type) => {
                    const typeSymbol = typeChecker.getSymbolAtLocation(type.expression);
                    return typeSymbol?.getName() === "RouteGroup";
                })
            );

            if (!extendsRouteGroup) {
                return;
            }

            const className = node.name.text;
            if (EXCLUDED_ROUTE_GROUPS.includes(className)) {
                return;
            }

            const component: Component = { name: className, endpoints: [] };
            components.push(component);

            const getHandlersMethod = node.members.find((member) =>
                ts.isMethodDeclaration(member) &&
                member.name &&
                ts.isIdentifier(member.name) &&
                member.name.text === "getHandlers"
            ) as ts.MethodDeclaration | undefined;

            if (!getHandlersMethod) {
                return;
            }

            const returnStatement = getHandlersMethod.body?.statements.find(
                (stmt) => ts.isReturnStatement(stmt)
            ) as ts.ReturnStatement | undefined;

            if (!returnStatement?.expression || !ts.isArrayLiteralExpression(returnStatement.expression)) {
                return;
            }

            const handlersArray = returnStatement.expression as ts.ArrayLiteralExpression;
            handlersArray.elements.forEach((element) => {
                if (!ts.isObjectLiteralExpression(element)) {
                    return;
                }

                const expresionesProperty = element.properties.find((prop) =>
                    ts.isPropertyAssignment(prop) &&
                    ts.isIdentifier(prop.name) &&
                    prop.name.text === "expresiones"
                ) as ts.PropertyAssignment | undefined;

                if (!expresionesProperty || !ts.isArrayLiteralExpression(expresionesProperty.initializer)) {
                    return;
                }

                const expresionesArray = expresionesProperty.initializer as ts.ArrayLiteralExpression;
                expresionesArray.elements.forEach((expresionElement) => {
                    if (!ts.isObjectLiteralExpression(expresionElement)) {
                        return;
                    }

                    const findProp = (name: string) => expresionElement.properties.find((prop) =>
                        ts.isPropertyAssignment(prop) &&
                        ts.isIdentifier(prop.name) &&
                        prop.name.text === name
                    ) as ts.PropertyAssignment | undefined;

                    const metodoProperty = findProp("metodos");
                    let metodos: string[] = [];
                    if (metodoProperty && ts.isArrayLiteralExpression(metodoProperty.initializer)) {
                        metodos = metodoProperty.initializer.elements
                            .filter(ts.isStringLiteral)
                            .map(lit => lit.text);
                    }

                    const resumenProperty = findProp("resumen");
                    let resumen = "";
                    if (resumenProperty && ts.isStringLiteral(resumenProperty.initializer)) {
                        resumen = resumenProperty.initializer.text;
                    }

                    const toJSON = (prop: ts.PropertyAssignment | undefined): IEsquema | undefined =>
                        prop ? tsToJSON(prop.initializer, typeChecker) as IEsquema : undefined;

                    metodos.forEach(metodo => {
                        component.endpoints.push({
                            method: metodo.toLowerCase(),
                            path: resumen,
                            querySchema:    toJSON(findProp("query")),
                            postSchema:     toJSON(findProp("post")),
                            responseSchema: toJSON(findProp("response")),
                            headerSchema:   toJSON(findProp("headers")),
                        });
                    });
                });
            });
        });
    }

    const services: Service[] = manifest.deploy.kustomize?.map(k => ({ name: k.name })) ?? [{ name: service }];
    return services.map(s => buildOpenAPI(components, s));
}

function tsToJSON(node: ts.Node, typeChecker: ts.TypeChecker): JSONValue {
    if (ts.isObjectLiteralExpression(node)) {
        const obj: {[key: string]: JSONValue} = {};
        node.properties.forEach(prop => {
            if (ts.isPropertyAssignment(prop)) {
                const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
                    ? prop.name.text
                    : undefined;
                if (key) {
                    obj[key] = tsToJSON(prop.initializer, typeChecker);
                }
            } else if (ts.isSpreadAssignment(prop)) {
                const spread = tsToJSON(prop.expression, typeChecker);
                if (spread && typeof spread === "object" && !Array.isArray(spread)) {
                    Object.assign(obj, spread);
                }
            } else if (ts.isShorthandPropertyAssignment(prop)) {
                obj[prop.name.text] = tsToJSON(prop.name, typeChecker);
            }
        });
        return obj;
    }
    if (ts.isCallExpression(node)) {
        const arg = node.arguments[0];
        return arg ? tsToJSON(arg, typeChecker) : null;
    }
    if (ts.isArrayLiteralExpression(node)) {
        return node.elements.map(el => tsToJSON(el, typeChecker));
    }
    if (ts.isStringLiteral(node))  { return node.text; }
    if (ts.isNumericLiteral(node)) { return Number(node.text); }
    if (node.kind === ts.SyntaxKind.TrueKeyword)  { return true; }
    if (node.kind === ts.SyntaxKind.FalseKeyword) { return false; }
    if (ts.isRegularExpressionLiteral(node)) { return node.text; }
    if (ts.isIdentifier(node)) { return resolveIdentifier(node, typeChecker); }
    return null;
}

function resolveIdentifier(node: ts.Identifier, typeChecker: ts.TypeChecker): JSONValue {
    let symbol = typeChecker.getSymbolAtLocation(node);
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
        symbol = typeChecker.getAliasedSymbol(symbol);
    }
    if (symbol?.valueDeclaration && ts.isVariableDeclaration(symbol.valueDeclaration) && symbol.valueDeclaration.initializer) {
        return tsToJSON(symbol.valueDeclaration.initializer, typeChecker);
    }
    return null;
}

function buildOpenAPI(components: Component[], service: Service): IOpenAPI {
    const doc: IOpenAPI = {
        openapi: "3.1.0",
        info: { title: service.name, version: "1", description: "Documentación automática de la API" },
        servers: [],
        paths: {},
        tags: [],
    };

    components.forEach(component => {
        doc.tags?.push({ name: component.name, description: `Endpoints for ${component.name}` });

        component.endpoints.forEach(endpoint => {
            const path: IPath = {};
            let pathMethod: IHTTPMethod = {};

            if (endpoint.querySchema) {
                (pathMethod.parameters ??= []).push(...buildParameters(endpoint.querySchema, "query"));
            }
            if (endpoint.headerSchema) {
                (pathMethod.parameters ??= []).push(...buildParameters(endpoint.headerSchema, "header"));
            }
            if (endpoint.responseSchema) {
                pathMethod.responses = {
                    "200": {
                        description: "Successful Response",
                        content: { "application/json": { schema: buildSchemaFromResponseObject(endpoint.responseSchema) } },
                    },
                };
            }

            if (endpoint.method === "get") {
                path.get = { ...pathMethod, description: `Auto-generated GET endpoint for ${endpoint.path}`, tags: [component.name] };
            } else if (endpoint.method === "post") {
                path.post = { ...pathMethod, description: `Auto-generated POST endpoint for ${endpoint.path}`, tags: [component.name] };
                if (endpoint.postSchema) {
                    const postSchema = endpoint.postSchema;
                    const schema: ISchema = { type: "object", properties: {}, required: [] };
                    Object.keys(postSchema).forEach(propName => {
                        schema.properties![propName] = {
                            type: typeof postSchema[propName].regex === "string" ? "string" : postSchema[propName].type ?? "string",
                            description: postSchema[propName].description || "",
                        };
                        if (postSchema[propName].required) {
                            schema.required!.push(propName);
                        }
                    });
                    path.post.requestBody = { content: { "application/json": { schema } } };
                }
            }

            doc.paths![endpoint.path] = path;
        });
    });

    return doc;
}

function buildParameters(spec: IEsquema, type: "query"|"header"): IParameter[] {
    return Object.keys(spec).map(paramName => ({
        name: paramName,
        in: type,
        required: !spec[paramName].opcional,
        schema: { type: typeof spec[paramName].regex === "string" ? "string" : spec[paramName].type ?? "string" },
        description: spec[paramName].description || "",
    }));
}

function buildSchemaFromResponseObject(spec: IEsquema): ISchema {
    const schema: ISchema = { type: "object", properties: {}, required: [] };

    Object.keys(spec).forEach(propName => {
        const propSpec = spec[propName];
        switch (propSpec.type) {
            case "array":
                schema.properties![propName] = {
                    type: "array",
                    description: propSpec.description,
                    items: buildSchemaFromResponseObject({ items: { ...propSpec.items } }).properties!["items"] as IItems,
                };
                break;
            case "object": {
                const nested = buildSchemaFromResponseObject(propSpec.properties ?? {});
                schema.properties![propName] = {
                    type: "object",
                    description: propSpec.description,
                    properties: nested.properties,
                    required: nested.required,
                };
                break;
            }
            default:
                schema.properties![propName] = { type: propSpec.type ?? "string", description: propSpec.description || "" };
                break;
        }
        if (propSpec.required) {
            schema.required!.push(propName);
        }
    });

    return schema;
}
