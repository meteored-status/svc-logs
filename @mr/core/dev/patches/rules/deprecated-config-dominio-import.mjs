import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedConfigDominioImportRule = createSimpleRule({
    id: "R005-deprecated-config-dominio-import",
    summary: "services-comun/modules/net/config/dominio -> @mr/core-network/server/http/config/dominio",
    source: "services-comun/modules/net/config/dominio",
    target: "@mr/core-network/server/http/config/dominio",
});
