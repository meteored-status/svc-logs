import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedServicesMainImportRule = createSimpleRule({
    id: "R022-deprecated-services-main-import",
    summary: "services-comun/main -> @mr/core-workload",
    source: "services-comun/main",
    target: "@mr/core-workload",
    skipIfContains: ["services-comun/cluster"],
});

