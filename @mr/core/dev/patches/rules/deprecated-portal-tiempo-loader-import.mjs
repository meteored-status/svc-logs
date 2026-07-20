import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedPortalTiempoLoaderImportRule = createSimpleRule({
    id: "R029-deprecated-portal-tiempo-loader-import",
    summary: "services-comun-meteored/modules/portal/tiempo/loader -> @mr/user-tiempo-domain/loader",
    source: "services-comun-meteored/modules/portal/tiempo/loader",
    target: "@mr/user-tiempo-domain/loader",
});

