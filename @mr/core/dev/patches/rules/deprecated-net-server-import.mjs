import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedNetServerImportRule = createSimpleRule({
    id: "R012-deprecated-net-server-import",
    summary: "services-comun/modules/net/server -> @mr/core-network/server/http/server",
    source: "services-comun/modules/net/server",
    target: "@mr/core-network/server/http/server",
});

