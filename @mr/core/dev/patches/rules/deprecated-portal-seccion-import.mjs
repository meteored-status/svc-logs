import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedPortalSeccionImportRule = createSimpleRule({
    id: "R017-deprecated-portal-seccion-import",
    summary: "services-comun-meteored/modules/portal/meteored/seccion/* -> @mr/user-mr-domain/section/*",
    source: "services-comun-meteored/modules/portal/meteored/seccion/",
    target: "@mr/user-mr-domain/section/",
});

