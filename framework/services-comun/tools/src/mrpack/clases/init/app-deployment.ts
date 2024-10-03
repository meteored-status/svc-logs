export default `
process.env.ZONA ??= "desarrollo";

Symbol.dispose ??= Symbol("Symbol.dispose");
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");

const { AlwaysOffSampler, AlwaysOnSampler, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { registerInstrumentations} = require('@opentelemetry/instrumentation');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { TraceExporter } = require('@google-cloud/opentelemetry-cloud-trace-exporter');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// const {diag, DiagConsoleLogger, DiagLogLevel} = require("@opentelemetry/api");
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const produccion = !["desarrollo", "test", undefined].includes(process.env.ZONA);
// const produccion = true;
// const produccion = false;

const provider = new NodeTracerProvider({
    resource: new Resource({
        [SemanticResourceAttributes.HOST_NAME]: require("node:os").hostname(),
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.npm_package_name,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
    }),
    sampler: produccion ?
        new AlwaysOnSampler():
        new AlwaysOffSampler(),
});
registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
        new HttpInstrumentation({
            // ignoreIncomingPaths: [/^\\/admin\\//],
            ignoreIncomingRequestHook: (request) => (request.url??"/admin/").startsWith("/admin/"),
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

require("./init");
require("source-map-support").install();
require("./output/app");
`.trimStart();
