import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedI18nIndexImportRule = createSimpleRule({
    id: "R007-deprecated-i18n-index-import",
    summary: "services-comun/modules/net/i18n -> @mr/core-i18n/langs",
    source: "services-comun/modules/net/i18n",
    target: "@mr/core-i18n/langs",
    // El subpath /net tiene su propia regla R006; evitar reescribirlo aqui.
    skipIfContains: ["services-comun/modules/net/i18n/net"],
});
