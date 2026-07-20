import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedServicesClusterImportRule = createSimpleRule({
    id: "R021-deprecated-services-cluster-import",
    summary: "services-comun/cluster -> @mr/core-workload",
    source: "services-comun/cluster",
    target: "@mr/core-workload",
});
