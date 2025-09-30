import http from "node:http";
import https from "node:https";
import tls, {type SecureContext} from "node:tls";
import {parse, stringify} from "qs";
import formidable, {type Fields, type Files} from "formidable";

import type {Net} from "./config/net";
import type {Routes} from "./routes";
import {Conexion} from "./conexion";
// import {IPodInfo} from "../utiles/config";
import {Router} from "./router";
// import {Tracer} from "./tracer";
import {error, formatTiempo, info, warning} from "../utiles/log";
import {isDir, readDir, readFile, readJSON} from "../utiles/fs";

export class Server {
    /* INSTANCE */
    private serverHTTP: http.Server|null;
    private serverHTTPS: https.Server|null;

    public constructor() {
        this.serverHTTP = null;
        this.serverHTTPS = null;
    }

    public iniciarHTTP(requestHandlers: Routes, /*pod: IPodInfo,*/ config: Net): void {
        if (this.serverHTTP==null) {
            const server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
                setImmediate(()=>{
                    this.onRequest(request, response, requestHandlers, /*pod,*/ config, false);
                });
            });
            server.addListener("error", (err)=>{
                error("Error de servidor HTTP", err);
            });
            if (config.maxConnections!==undefined) {
                server.maxConnections = config.maxConnections;
            }
            if (config.timeout!==undefined) {
                server.timeout = config.timeout;
            }
            server.listen(config.puertos.http, ()=>{
                if (!PRODUCCION) {
                    info(`Servidor Web iniciado en:`, config.endpoints.http);
                }
            });

            this.serverHTTP = server;
        }
    }

    public async iniciarHTTPs(requestHandlers: Routes, /*pod: IPodInfo,*/ config: Net): Promise<void> {
        if (this.serverHTTPS==null) {
            const contextos = new Map<string, SecureContext>();
            for (const dir of await readDir("files/ssl")) {
                if (!await isDir(`files/ssl/${dir}`)) {
                    continue;
                }

                info("Cargando certificados para:", dir);
                const dominios = await readJSON<string[]>(`files/ssl/${dir}/dominios.json`);
                const contexto = tls.createSecureContext({
                    key: await readFile(`files/ssl/${dir}/privkey.pem`),
                    cert: await readFile(`files/ssl/${dir}/fullchain.pem`)
                });
                for (const dominio of dominios) {
                    contextos.set(dominio, contexto);
                }
            }

            const server = https.createServer({
                cert: await readFile("files/ssl/fullchain.pem"),
                key: await readFile("files/ssl/privkey.pem"),
                SNICallback: (servername: string, cb: (err: Error | null, ctx?: SecureContext) => void) => {
                    const ctx = contextos.get(servername);
                    if (ctx===undefined) {
                        cb(null);
                    } else {
                        cb(null, ctx);
                    }
                },
            }, (request: http.IncomingMessage, response: http.ServerResponse) => {
                setImmediate(()=>{
                    this.onRequest(request, response, requestHandlers, /*pod,*/ config, true);
                });
            });
            server.addListener("error", (err)=>{
                error("Error de servidor HTTPS", err);
            });
            if (config.maxConnections!==undefined) {
                server.maxConnections = config.maxConnections;
            }
            if (config.timeout!==undefined) {
                server.timeout = config.timeout;
            }
            server.listen(config.puertos.https, ()=>{
                if (!PRODUCCION) {
                    info(`Servidor Web Seguro iniciado en:`, config.endpoints.https);
                }
            });

            this.serverHTTPS = server;
        }
    }

    private onRequest(request: http.IncomingMessage, response: http.ServerResponse, request_handlers: Routes, /*pod: IPodInfo,*/ config: Net, seguro: boolean): void {
        // const tracer = Tracer.build(request, pod);

        const conexion = new Conexion(request, response, request_handlers.error, /*tracer,*/ config, request.headers["x-forwarded-proto"]!==undefined ? request.headers["x-forwarded-proto"]==="https" : seguro);

        if (!["POST","PUT"].includes(conexion.metodo)) {
            request.setEncoding("utf8");
            request.addListener("data", () => undefined);
            request.addListener("error", (err: NodeJS.ErrnoException) => {
                switch (err.code) {
                    case "ECONNRESET":
                        break;
                    default:
                        error("Error de request (GET)", err);
                        break;
                }
                request.removeAllListeners();
                conexion.error(500, err.message, err).finally(()=>undefined);
            });
            request.addListener("end", () => {
                const timeout: NodeJS.Timeout|undefined = config.slow>0 ? setTimeout(()=>{
                    warning("Tiempo de respuesta excesivo (>1sg)", conexion.url);
                }, config.slow) : undefined;
                conexion.iniciado();
                request.removeAllListeners();
                Router.route(request_handlers, conexion).finally(() => {
                    if (timeout!==undefined) {
                        clearTimeout(timeout);
                        const intervalo = Date.now() - conexion.start.getTime();
                        if (intervalo > 1000) {
                            warning(`Tiempo de respuesta excesivo (${formatTiempo(intervalo)})`, conexion.url);
                        }
                    }
                });
            });
        } else {
            const type = conexion.getHeaders()["content-type"]?.toLowerCase()??"";
            if (type.includes("json") || type.includes("multipart") || type.includes("octet-stream")) {
                formidable({
                    encoding: "utf-8",
                    keepExtensions: true,
                    multiples: true,
                    uploadDir: config.uploadDir,
                    maxFileSize: config.maxFileSize,
                    maxTotalFileSize: config.maxFileSize * 10,
                }).parse(request, (err: NodeJS.ErrnoException, fields: Fields, files: Files) => {
                    if (!err) {
                        if (type.includes("multipart")) {
                            const querystring: string[] = [];
                            for (const key of Object.keys(fields)) {
                                const values = fields[key];
                                for (const value of Array.isArray(values) ? values : [values]) {
                                    querystring.push(stringify({
                                        [key]: value,
                                    }));
                                }
                            }
                            const parsed = parse(querystring.join("&"));
                            conexion.post = parsed;
                            conexion.postRAW = JSON.stringify(parsed);
                        // } else if (type.includes("urlencoded")) {
                        //     conexion.post = fields;
                        //     conexion.postRAW = stringify(fields, {arrayFormat: "comma"});
                        } else {
                            conexion.post = fields;
                            conexion.postRAW = JSON.stringify(fields);
                        }
                        conexion.files = files;
                        conexion.iniciado();
                        Router.route(request_handlers, conexion).finally(()=>undefined);
                    } else {
                        error("Error de request (parseando datos [formidable])", conexion.get, JSON.stringify(err));
                        conexion.error(500, err.message, err).finally(()=>undefined);
                    }
                });
            } else {
                const chunks: string[] = [];
                request.setEncoding("utf8");
                request.addListener("data", (data: string) => {
                    chunks.push(data);
                });
                request.addListener("error", (err: NodeJS.ErrnoException) => {
                    switch (err.code) {
                        case "ECONNRESET":
                            break;
                        default:
                            error("Error de request (parseando datos [custom])", err);
                            break;
                    }
                    request.removeAllListeners();
                    conexion.error(500, err.message, err).finally(()=>undefined);
                });
                request.addListener("end", () => {
                    conexion.postRAW = chunks.join("");
                    if (type.includes("urlencoded")) {
                        conexion.post = parse(conexion.postRAW);
                    }
                    conexion.iniciado();
                    request.removeAllListeners();
                    Router.route(request_handlers, conexion).finally(()=>undefined);
                });
            }
        }
    }
}

export default new Server();
