import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedUtilesUnidadesImportRule = createSimpleRule({
    id: "R036-deprecated-utiles-unidades-import",
    summary: "services-comun/modules/utiles/unidades -> @mr/core-utils/unidades",
    source: "services-comun/modules/utiles/unidades",
    target: "@mr/core-utils/unidades",
});
