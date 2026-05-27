import {createSimpleRule} from "../rule-factory.mjs";

export const deprecatedNetDeviceImportRule = createSimpleRule({
    id: "R009-deprecated-net-device-import",
    summary: "services-comun/modules/net/device -> @mr/core-network/server/http/config/device",
    source: "services-comun/modules/net/device",
    target: "@mr/core-network/server/http/config/device",
});
