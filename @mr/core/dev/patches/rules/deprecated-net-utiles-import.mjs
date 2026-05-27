import {createSplitRule} from "../rule-factory.mjs";

export const deprecatedNetUtilesImportRule = createSplitRule({
    id: "R010-deprecated-net-utiles-import",
    summary: "services-comun/modules/net/utiles -> isbot + @mr/core-network/client/ua",
    source: "services-comun/modules/net/utiles",
    targets: [
        {
            symbols: ["isBot"],
            target: "isbot",
            // En el nuevo paquete el export se llama `isbot` (minusculas).
            renames: {isBot: "isbot"},
        },
        {
            symbols: ["randomUA"],
            target: "@mr/core-network/client/ua",
        },
    ],
});
