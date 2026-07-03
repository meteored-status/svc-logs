import {createLineRegexRule} from "../rule-factory.mjs";

export const deprecatedEngineBaseImportRule = createLineRegexRule({
    id: "R023-deprecated-engine-base-import",
    summary: "{EngineBase} from services-comun/modules/engine_base -> {Engine as EngineBase} from @mr/core-workload/engine",
    detect: "services-comun/modules/engine_base",
    regex: /^\s*import(\s+type)?\s+\{\s*EngineBase\s*\}\s+from\s+(["'])services-comun\/modules\/engine_base\2;\s*$/,
    replacement: (_, typeKw, quote) => `import${typeKw ?? ""} {Engine as EngineBase} from ${quote}@mr/core-workload/engine${quote};`,
    skipFilePathIncludes: ["/@mr/core/dev/patches/"],
});


