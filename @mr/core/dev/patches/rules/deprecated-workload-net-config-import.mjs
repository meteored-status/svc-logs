const TARGET = "@mr/core-workload/config/net";

export const deprecatedWorkloadNetConfigImportRule = {
    id: "R025-deprecated-workload-net-config-import",
    summary: "{ConfiguracionNet, IConfiguracionNet} from @mr/core-network/server/http/config/config -> @mr/core-workload/config/net",
    apply(content, filePath = "") {
        if (filePath.includes("/@mr/core/dev/patches/")) {
            return {content, replacements: 0};
        }

        let replacements = 0;
        const next = content.replace(
            /import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+(["'])@mr\/core-network\/server\/http\/config\/config\3\s*;?/g,
            (statement, importTypeKw, specifiers) => {
                const normalized = specifiers
                    .split(",")
                    .map((symbol) => symbol.trim())
                    .filter(Boolean)
                    .map((symbol) => symbol.replace(/^type\s+/, ""));

                if (!normalized.includes("ConfiguracionNet") || !normalized.includes("IConfiguracionNet")) {
                    return statement;
                }

                replacements += 1;
                const hasImportType = typeof importTypeKw === "string" && importTypeKw.trim().length > 0;
                const hasInlineType = /\btype\s+IConfiguracionNet\b/.test(specifiers);
                const typePrefix = hasImportType || hasInlineType ? "type " : "";
                return `import {ConfiguracionNet, ${typePrefix}IConfiguracionNet} from "${TARGET}";`;
            },
        );

        return {content: next, replacements};
    },
};
