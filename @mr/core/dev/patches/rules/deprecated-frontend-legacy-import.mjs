import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedFrontendLegacyImportRule = createSimpleRule({
    id: "R034-deprecated-frontend-legacy-import",
    summary: "services-comun/modules/frontend/* -> @mr/core-templates/legacy/*",
    source: "services-comun/modules/frontend",
    target: "@mr/core-templates/legacy",
});
