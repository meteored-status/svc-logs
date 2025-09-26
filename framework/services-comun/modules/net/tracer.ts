// import type {IncomingMessage} from "node:http";
// import os from "node:os";
//
// import opentelemetry, {
//     type Tracer as OTTracer,
//     type Span as OTSpan,
//     SpanKind,
//     type SpanStatus,
//     type Attributes,
//     type AttributeValue,
//     SpanStatusCode,
// } from "@opentelemetry/api";
//
// import type {IPodInfo} from "../utiles/config";
//
// export class Tracer {
//     /* STATIC */
//     public static build(request: IncomingMessage, pod: IPodInfo): Tracer {
//         return new this(opentelemetry.trace.getTracer(pod.servicio), request, pod);
//     }
//
//     /* INSTANCE */
//     private readonly rootSpan: Span;
//     private finalizado: boolean;
//
//     private constructor(public ottracer: OTTracer, private request: IncomingMessage, private pod: IPodInfo) {
//         this.rootSpan = Span.buildRoot(request, this, this.pod.servicio, {
//             "/http/host": this.request.headers.host,
//             "/http/method": this.request.method,
//             "/http/path": this.request.url,
//             "/http/user_agent": this.request.headers["user-agent"],
//             "/servicio/nombre": this.pod.servicio,
//             "/servicio/pod": !PRODUCCION ? this.pod.servicio : os.hostname(),
//             "/servicio/version": this.pod.version,
//             "/servicio/zona": this.pod.zona,
//         });
//
//         this.finalizado = false;
//     }
//
//     public end(): void {
//         if (this.finalizado) {
//             return;
//         }
//
//         this.finalizado = true;
//         this.rootSpan.end();
//     }
//
//     public span(nombre: string): Span {
//         return Span.build(this, nombre);
//     }
//
//     // public subspan(nombre: string): Span {
//     //     return this.rootSpan.subspan(nombre);
//     // }
//
//     // public current(): Span {
//     //     return this.rootSpan.current();
//     // }
//
//     public setCode(codigo: number): Tracer {
//         this.rootSpan.setAttribute("http.status_code", codigo);
//
//         return this;
//     }
//
//     public setPlantilla(plantilla: string): Tracer {
//         this.rootSpan.setAttribute("/http/route", plantilla);
//
//         return this;
//     }
//
//     public setInterna(interna: boolean): Tracer {
//         this.rootSpan.setAttribute("/servicio/interno", interna);
//
//         return this;
//     }
// }
//
// export class Span {
//     /* STATIC */
//     public static build(tracer: Tracer, nombre: string, servidor: boolean = true): Span {
//         const span = tracer.ottracer.startActiveSpan(nombre,
//             {
//                 kind: servidor?SpanKind.SERVER:SpanKind.CLIENT,
//                 // startTime: new Date(),
//             }, span=>span);
//
//         return new this(tracer, span);
//     }
//
//     public static buildRoot(request: IncomingMessage, tracer: Tracer, nombre: string, attributes?: Attributes): Span {
//         const span = tracer.ottracer.startActiveSpan(nombre, {
//             kind: SpanKind.SERVER,
//             attributes,
//             // startTime: new Date(),
//         }, span=>span);
//
//         return new this(tracer, span);
//     }
//
//     /* INSTANCE */
//     public finalizado: boolean;
//     private readonly subspans: Span[];
//
//     private constructor(private readonly tracer: Tracer, private readonly span: OTSpan) {
//         this.finalizado = false;
//         this.subspans = [];
//     }
//
//     public setStatus(status: SpanStatus): void {
//         this.span.setStatus(status);
//     }
//
//     public error(err?: string): void {
//         this.span.setStatus({
//             code: SpanStatusCode.ERROR,
//             message: err,
//         });
//     }
//
//     public setAttribute(key: string, value: AttributeValue): void {
//         this.span.setAttribute(key, value);
//     }
//
//     public setAttributes(attributes: Attributes): void {
//         this.span.setAttributes(attributes);
//     }
//
//     public end(): void {
//         for (const subspan of this.subspans) {
//             subspan.end();
//         }
//
//         if (this.finalizado) {
//             return;
//         }
//         this.finalizado = true;
//         this.span.end();
//         // this.span.end(new Date());
//     }
//
//     public event(nombre: string, attributes?: Attributes): void {
//         this.span.addEvent(nombre, attributes);
//     }
//
//     // public subspan(nombre: string, servidor: boolean = true): Span {
//     //     const span = Span.build(this.tracer, nombre, servidor);
//     //     this.subspans.push(span);
//     //
//     //     return span;
//     // }
//
//     // public current(): Span {
//     //     for (const span of this.subspans.reverse()) {
//     //         if (!span.finalizado) {
//     //             return span.current();
//     //         }
//     //     }
//     //
//     //     return this;
//     // }
//
//     // public context(): IContext {
//     //     let propagation: any = {};
//     //     opentelemetry.propagation.inject(opentelemetry.context.active(), propagation);
//     //
//     //     return {
//     //         traceparent: propagation.traceparent,
//     //     };
//     // }
// }
