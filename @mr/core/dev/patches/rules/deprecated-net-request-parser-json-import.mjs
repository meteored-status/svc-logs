import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedNetRequestParserJsonImportRule = createSimpleRule({
    id: "R015-deprecated-net-request-parser-json-import",
    summary: "services-comun/modules/net/request/parser/json -> @mr/core-network/client/http/parser/json",
    source: "services-comun/modules/net/request/parser/json",
    target: "@mr/core-network/client/http/parser/json",
});

