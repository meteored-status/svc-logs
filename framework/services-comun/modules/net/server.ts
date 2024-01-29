import * as http from "node:http";
import * as https from "node:https";
import {parse, stringify} from "qs";
import formidable, {type Fields, type Files} from "formidable";

import type {Net} from "./config/net";
import type {Routes} from "./routes";
import {Conexion} from "./conexion";
import {IPodInfo} from "../utiles/config";
import {Router} from "./router";
import {Tracer} from "./tracer";
import {error, info} from "../utiles/log";
import {readFile} from "../utiles/fs";

export class Server {
    /* STATIC */
    private static readonly CONEXIONES_THRESHOLD: number = 10;

    private static checkConexiones(server: http.Server): void {
        setTimeout(()=>{
            server.getConnections((err: Error | null, count: number)=>{
                if (err!=undefined && count>this.CONEXIONES_THRESHOLD && process.send!=undefined) {
                    process.send({cmd: "spawn"});
                    info("Conexiones activas:", count);
                }

                this.checkConexiones(server);
            });
            server.closeIdleConnections();
        }, 1000);
    }

    /* INSTANCE */
    private serverHTTP: http.Server|null;
    private serverHTTPS: https.Server|null;

    public constructor() {
        this.serverHTTP = null;
        this.serverHTTPS = null;
    }

    public iniciarHTTP(requestHandlers: Routes, pod: IPodInfo, config: Net): void {
        if (this.serverHTTP==null) {
            const server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
                this.onRequest(request, response, requestHandlers, pod, config, false);
            });
            server.addListener("error", (err)=>{
                error("Error de servidor HTTP", err);
            });
            if (config.maxConnections!=undefined) {
                server.maxConnections = config.maxConnections;
            }
            if (config.timeout!=undefined) {
                server.timeout = config.timeout;
            }
            server.listen(config.puertos.http, ()=>{
                if (!PRODUCCION) {
                    info(`Servidor Web iniciado en:`, config.endpoints.http);
                }
            });

            this.serverHTTP = server;

            Server.checkConexiones(server);
        }
    }

    public async iniciarHTTPs(requestHandlers: Routes, pod: IPodInfo, config: Net): Promise<void> {
        if (this.serverHTTPS==null) {
            const server = https.createServer({
                cert: await readFile("files/ssl/fullchain.pem"),
                key: await readFile("files/ssl/privkey.pem"),
            }, (request: http.IncomingMessage, response: http.ServerResponse) => {
                this.onRequest(request, response, requestHandlers, pod, config, true);
            });
            server.addListener("error", (err)=>{
                error("Error de servidor HTTPS", err);
            });
            if (config.maxConnections!=undefined) {
                server.maxConnections = config.maxConnections;
            }
            if (config.timeout!=undefined) {
                server.timeout = config.timeout;
            }
            server.listen(config.puertos.https, ()=>{
                if (!PRODUCCION) {
                    info(`Servidor Web Seguro iniciado en:`, config.endpoints.https);
                }
            });

            this.serverHTTPS = server;

            Server.checkConexiones(server);
        }
    }

    private onRequest(request: http.IncomingMessage, response: http.ServerResponse, request_handlers: Routes, pod: IPodInfo, config: Net, seguro: boolean): void {
        const tracer = Tracer.build(request, pod);

        const conexion = new Conexion(request, response, request_handlers.error, tracer, pod, config, request.headers["x-forwarded-proto"]!=undefined ? request.headers["x-forwarded-proto"]=="https" : seguro);

        if (!["POST","PUT"].includes(conexion.metodo)) {
            request.setEncoding("utf8");
            request.addListener("data", () => {});
            request.addListener("error", (err: NodeJS.ErrnoException) => {
                switch (err.code) {
                    case "ECONNRESET":
                        break;
                    default:
                        error("Error de request (GET)", err);
                        break;
                }
                request.removeAllListeners();
                conexion.error(500, err.message, err).then(()=>{}).catch(()=>{});
            });
            request.addListener("end", () => {
                conexion.iniciado();
                request.removeAllListeners();
                Router.route(request_handlers, conexion).then(()=>{}).catch(()=>{});
            });
        } else {
            const type = conexion.getHeaders()["content-type"]?.toLowerCase()??"";
            if (type.includes("json") || type.includes("urlencoded") || type.includes("multipart") || type.includes("octet-stream")) {
                formidable({
                    encoding: "utf-8",
                    keepExtensions: true,
                    multiples: true,
                    uploadDir: config.uploadDir,
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
                        } else {
                            conexion.post = fields;
                            conexion.postRAW = JSON.stringify(fields);
                        }
                        conexion.files = files;
                        conexion.iniciado();
                        Router.route(request_handlers, conexion).then(()=>{}).catch(()=>{});
                    } else {
                        error("Error de request (parseando datos [formidable])", err);
                        conexion.error(500, err.message, err).then(()=>{}).catch(()=>{});
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
                    conexion.error(500, err.message, err).then(()=>{}).catch(()=>{});
                });
                request.addListener("end", () => {
                    conexion.postRAW = chunks.join("");
                    conexion.iniciado();
                    request.removeAllListeners();
                    Router.route(request_handlers, conexion).then(()=>{}).catch(()=>{});
                });
            }
        }
    }
}

export default new Server();
