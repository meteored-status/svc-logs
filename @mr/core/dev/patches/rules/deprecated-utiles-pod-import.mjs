import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedUtilesPodImportRule = createSimpleRule({
    id: "R027-deprecated-utiles-pod-import",
    summary: "services-comun/modules/utiles/pod -> @mr/core-workload/config/pod",
    source: "services-comun/modules/utiles/pod",
    target: "@mr/core-workload/config/pod",
});

