import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedNetInterfaceImportRule = createSimpleRule({
    id: "R008-deprecated-net-interface-import",
    summary: "services-comun/modules/net/interface -> @mr/core-network/client/http/interface",
    source: "services-comun/modules/net/interface",
    target: "@mr/core-network/client/http/interface",
});
