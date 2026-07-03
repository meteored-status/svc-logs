import {createLineRegexRule} from "../rule-factory.mjs";

export const deprecatedEngineServerImportRule = createLineRegexRule({
    id: "R024-deprecated-engine-server-import",
    summary: "{EngineServer} from services-comun/modules/engine_server -> {Engine as EngineServer} from @mr/core-workload/engine/server",
    detect: "services-comun/modules/engine_server",
    regex: /^\s*import(\s+type)?\s+\{\s*EngineServer\s*\}\s+from\s+(["'])services-comun\/modules\/engine_server\2;\s*$/,
    replacement: (_, typeKw, quote) => `import${typeKw ?? ""} {Engine as EngineServer} from ${quote}@mr/core-workload/engine/server${quote};`,
    skipFilePathIncludes: ["/@mr/core/dev/patches/"],
});

