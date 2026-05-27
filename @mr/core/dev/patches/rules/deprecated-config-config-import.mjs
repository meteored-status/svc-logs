import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedConfigConfigImportRule = createSimpleRule({
    id: "R004-deprecated-config-config-import",
    summary: "services-comun/modules/net/config/config -> @mr/core-network/server/http/config/config",
    source: "services-comun/modules/net/config/config",
    target: "@mr/core-network/server/http/config/config",
});
