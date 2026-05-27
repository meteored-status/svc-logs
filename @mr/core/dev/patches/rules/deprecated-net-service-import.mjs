import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedNetServiceImportRule = createSimpleRule({
    id: "R011-deprecated-net-service-import",
    summary: "services-comun/modules/net/service -> @mr/core-network/server/http/service",
    source: "services-comun/modules/net/service",
    target: "@mr/core-network/server/http/service",
});

