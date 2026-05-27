import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedRouteGroupBlockImportRule = createSimpleRule({
    id: "R003-deprecated-routes-group-block-import",
    summary: "services-comun/modules/net/routes/group/block -> @mr/core-network/server/http/routes/group/block",
    source: "services-comun/modules/net/routes/group/block",
    target: "@mr/core-network/server/http/routes/group/block",
});
