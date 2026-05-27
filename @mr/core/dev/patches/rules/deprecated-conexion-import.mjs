import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedConexionImportRule = createSimpleRule({
    id: "R001-deprecated-conexion-import",
    summary: "services-comun/modules/net/conexion -> @mr/core-network/server/http/conexion",
    source: "services-comun/modules/net/conexion",
    target: "@mr/core-network/server/http/conexion",
});
