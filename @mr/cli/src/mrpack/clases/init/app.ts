import {ManifestDeploymentKind} from "@mr/cli/manifest/deployment";

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
