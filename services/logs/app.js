process.env.CLIENTE ??= "";
process.env.ENTORNO ??= "desarrollo";
process.env.ZONA ??= "desarrollo";

if (process.env["DATADOG"]==="true") {
    const tracer = require("dd-trace").init();
    const blocklistStatus = [/^\/admin\/.*/, "/admin"];
    const blocklistIstio = ["/healthz/ready", "/quitquitquit"];
    tracer.use("http", {
        blocklist: blocklistStatus,
    });
    tracer.use("fetch", {
        blocklist: [...blocklistStatus, ...blocklistIstio],
    });
}

Symbol.dispose ??= Symbol("Symbol.dispose");
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");

require("./init");
require("source-map-support").install();
require("./output/app");
