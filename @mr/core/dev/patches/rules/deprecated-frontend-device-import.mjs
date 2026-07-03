import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedFrontendDeviceImportRule = createSimpleRule({
    id: "R016-deprecated-frontend-device-import",
    summary: "services-comun/modules/frontend/device -> @mr/core-templates/device",
    source: "services-comun/modules/frontend/device",
    target: "@mr/core-templates/device",
});

