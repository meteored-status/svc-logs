import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedPortalIdiomasImportRule = createSimpleRule({
    id: "R020-deprecated-portal-idiomas-import",
    summary: "services-comun-meteored/modules/portal/idiomas -> @mr/user-mr-domain/idiomas",
    source: "services-comun-meteored/modules/portal/idiomas",
    target: "@mr/user-mr-domain/idiomas",
});

