import os from "node:os";
import {AlwaysOffSampler, AlwaysOnSampler, BatchSpanProcessor} from "@opentelemetry/sdk-trace-base";
import {HttpInstrumentation} from "@opentelemetry/instrumentation-http";
import {registerInstrumentations} from "@opentelemetry/instrumentation";
import {NodeTracerProvider} from "@opentelemetry/sdk-trace-node";
import {Resource} from "@opentelemetry/resources";
import {TraceExporter} from "@google-cloud/opentelemetry-cloud-trace-exporter";
import {SemanticResourceAttributes} from "@opentelemetry/semantic-conventions";

export interface ITelemetryConfig {
    enabled: boolean;
    ignore: string[];
}

export default (config: Partial<ITelemetryConfig>={})=>{
    const configuracion: ITelemetryConfig = {
        enabled: true,
        ignore: ["/admin/"],
        ...config,
    };

    if (!configuracion.ignore.includes("/admin/")) {
        configuracion.ignore.unshift("/admin/");
    }
// const {diag, DiagConsoleLogger, DiagLogLevel} from "@opentelemetry/api");
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

    const produccion = configuracion.enabled && PRODUCCION && !TEST;
// const produccion = true;
// const produccion = false;

    const provider = new NodeTracerProvider({
        resource: new Resource({
            [SemanticResourceAttributes.HOST_NAME]: os.hostname(),
            [SemanticResourceAttributes.SERVICE_NAME]: process.env["npm_package_name"],
            [SemanticResourceAttributes.SERVICE_VERSION]: process.env["npm_package_version"],
        }),
        sampler: produccion ?
            new AlwaysOnSampler():
            new AlwaysOffSampler(),
    });
    registerInstrumentations({
        tracerProvider: provider,
        instrumentations: [
            new HttpInstrumentation({
                // ignoreIncomingPaths: [/^\/admin\//],
                ignoreIncomingRequestHook: (request) => {
                    const url = request.url??"/admin/";
                    return configuracion.ignore.find(path=>url.startsWith(path))!=undefined;
                    // return url.startsWith("/admin/");
                },
            }),
            // new FetchInstrumentation(),
        ],
    });

    if (produccion) {
        const exporter = new TraceExporter({
            keyFilename: "files/credenciales/trace.json",
        });

        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    }

// Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
    provider.register();
}
