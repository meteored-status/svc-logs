import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedPortalConfigImportRule = createSimpleRule({
    id: "R019-deprecated-portal-config-import",
    summary: "services-comun-meteored/modules/portal/meteored/config/* -> @mr/user-mr-domain/config/*",
    source: "services-comun-meteored/modules/portal/meteored/config/",
    target: "@mr/user-mr-domain/config/",
});

