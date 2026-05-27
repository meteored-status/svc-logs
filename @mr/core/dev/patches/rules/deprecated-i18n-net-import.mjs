import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedI18nNetImportRule = createSimpleRule({
    id: "R006-deprecated-i18n-net-import",
    summary: "services-comun/modules/net/i18n/net -> @mr/core-network/server/http/i18n",
    source: "services-comun/modules/net/i18n/net",
    target: "@mr/core-network/server/http/i18n",
});
