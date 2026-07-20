import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedPortalMeteoredImportRule = createSimpleRule({
    id: "R018-deprecated-portal-meteored-import",
    summary: "services-comun-meteored/modules/portal/meteored/* -> @mr/user-mr-domain/*",
    source: "services-comun-meteored/modules/portal/meteored",
    target: "@mr/user-mr-domain",
});

