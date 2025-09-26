// import os from "node:os";
// import {AlwaysOffSampler, AlwaysOnSampler, BatchSpanProcessor} from "@opentelemetry/sdk-trace-base";
// import {HttpInstrumentation} from "@opentelemetry/instrumentation-http";
// import {registerInstrumentations} from "@opentelemetry/instrumentation";
// import {NodeTracerProvider} from "@opentelemetry/sdk-trace-node";
// import {Resource} from "@opentelemetry/resources";
// import {TraceExporter} from "@google-cloud/opentelemetry-cloud-trace-exporter";
// import {ATTR_HOST_NAME, ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from "@opentelemetry/semantic-conventions/incubating";
//
// export interface ITelemetryConfig {
//     enabled: boolean;
//     ignore: string[];
// }
//
// export default (config: Partial<ITelemetryConfig>={})=>{
//     const configuracion: ITelemetryConfig = {
//         enabled: true,
//         ignore: ["/admin/"],
//         ...config,
//     };
//
//     if (!configuracion.ignore.includes("/admin/")) {
//         configuracion.ignore.unshift("/admin/");
//     }
// // const {diag, DiagConsoleLogger, DiagLogLevel} from "@opentelemetry/api");
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
//
//     const produccion = configuracion.enabled && PRODUCCION && !TEST;
// // const produccion = true;
// // const produccion = false;
//
//     const provider = new NodeTracerProvider({
//         resource: new Resource({
//             [ATTR_HOST_NAME]: os.hostname(),
//             [ATTR_SERVICE_NAME]: process.env["npm_package_name"],
//             [ATTR_SERVICE_VERSION]: process.env["npm_package_version"],
//         }),
//         sampler: produccion ?
//             new AlwaysOnSampler():
//             new AlwaysOffSampler(),
//     });
//     registerInstrumentations({
//         tracerProvider: provider,
//         instrumentations: [
//             new HttpInstrumentation({
//                 // ignoreIncomingPaths: [/^\/admin\//],
//                 ignoreIncomingRequestHook: (request) => {
//                     const url = request.url??"/admin/";
//                     return configuracion.ignore.find(path=>url.startsWith(path))!=undefined;
//                     // return url.startsWith("/admin/");
//                 },
//             }),
//             // new FetchInstrumentation(),
//         ],
//     });
//
//     if (produccion) {
//         const exporter = new TraceExporter({
//             keyFilename: "files/credenciales/trace.json",
//         });
//
//         provider.addSpanProcessor(new BatchSpanProcessor(exporter));
//     }
//
// // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
//     provider.register();
// }
