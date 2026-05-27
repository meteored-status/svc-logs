import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedRouteGroupImportRule = createSimpleRule({
    id: "R002-deprecated-routes-group-import",
    summary: "services-comun/modules/net/routes/group -> @mr/core-network/server/http/routes/group",
    source: "services-comun/modules/net/routes/group",
    target: "@mr/core-network/server/http/routes/group",
    // El subpath /block tiene su propia regla R003; evitar reescribirlo aqui.
    skipIfContains: ["services-comun/modules/net/routes/group/block"],
});
