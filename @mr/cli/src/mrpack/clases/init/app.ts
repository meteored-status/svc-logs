/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: 61b53b65ca69fa3b955c01a068889104
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

import {ManifestDeploymentKind} from "@mr/core-dev/manifest/deployment";

interface IApp {
    type: ManifestDeploymentKind;
}
export default ({type}: IApp)=>{
    const tracer: string[] = [];
    const lists: string[] = [];
    if ([ManifestDeploymentKind.SERVICE].includes(type)) {
        lists.push(`    const blocklistStatus = [/^\\/admin\\/.*/, "/admin"];`);
        lists.push(`    const blocklistIstio = ["/healthz/ready", "/quitquitquit"];`);
        tracer.push(`
    tracer.use("http", {
        blocklist: blocklistStatus,
    });`);
        tracer.push(`
    tracer.use("fetch", {
        blocklist: [...blocklistStatus, ...blocklistIstio],
    });`);
    }
    if ([ManifestDeploymentKind.CRONJOB, ManifestDeploymentKind.JOB].includes(type)) {
        lists.push(`    const blocklistStatus = [/^\\/admin\\/.*/, "/admin"];`);
        lists.push(`    const blocklistIstio = ["/healthz/ready", "/quitquitquit"];`);
        tracer.push(`
    tracer.use("fetch", {
        blocklist: [...blocklistStatus, ...blocklistIstio],
    });`);
    }

    return `
require("source-map-support").install();

process.env.CLIENTE ??= "";
process.env.ENTORNO ??= "desarrollo";
process.env.SIDECAR ??= "true";
process.env.ZONA ??= "desarrollo";

if (process.env["DATADOG"]==="true") {
    const tracer = require("dd-trace").init();
${lists.join("\n")}${tracer.join("")}
}

Symbol.dispose ??= Symbol("Symbol.dispose");
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");

require("./output/app");
`.trimStart()
};
