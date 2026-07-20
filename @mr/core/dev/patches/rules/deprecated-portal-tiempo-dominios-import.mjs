import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedPortalTiempoDominiosImportRule = createSimpleRule({
    id: "R028-deprecated-portal-tiempo-dominios-import",
    summary: "services-comun-meteored/modules/portal/tiempo/dominios/* -> @mr/user-tiempo-domain/sites/*",
    source: "services-comun-meteored/modules/portal/tiempo/dominios/",
    target: "@mr/user-tiempo-domain/sites/",
});

