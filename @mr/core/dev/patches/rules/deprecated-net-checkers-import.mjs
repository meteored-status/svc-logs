import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedNetCheckersImportRule = createSimpleRule({
    id: "R013-deprecated-net-checkers-import",
    summary: "services-comun/modules/net/checkers -> @mr/core-network/server/http/checkers",
    source: "services-comun/modules/net/checkers",
    target: "@mr/core-network/server/http/checkers",
});

