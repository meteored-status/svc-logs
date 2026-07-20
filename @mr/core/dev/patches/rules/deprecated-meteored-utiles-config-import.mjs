const SOURCE = "services-comun/modules/utiles/config";
const TARGET_ORDER = [
    "@mr/core-utils/config",
    "@mr/core-workload/config/google",
    "@mr/core-workload/config/google/storage",
    "@mr/core-workload/config/pod",
    "@mr/core-workload/config",
];

const SYMBOL_MAP = {
    IConfigGenerico: {target: "@mr/core-utils/config", importedName: "IConfiguracion"},
    ConfigGenerico: {target: "@mr/core-utils/config", importedName: "Configuracion"},
    IGoogle: {target: "@mr/core-workload/config/google", importedName: "IGoogle"},
    Google: {target: "@mr/core-workload/config/google", importedName: "Google"},
    IGoogleStorage: {target: "@mr/core-workload/config/google/storage", importedName: "IGoogleStorage"},
    GoogleStorage: {target: "@mr/core-workload/config/google/storage", importedName: "GoogleStorage"},
    IPodInfo: {target: "@mr/core-workload/config/pod", importedName: "IPodInfo"},
    crearPodInfo: {target: "@mr/core-workload/config/pod", importedName: "crearPodInfo"},
    IConfiguracion: {target: "@mr/core-workload/config", importedName: "IConfiguracion"},
    Configuracion: {target: "@mr/core-workload/config", importedName: "Configuracion"},
};

function parseSpecifier(rawSpecifier, {forceType = false} = {}) {
    const trimmed = rawSpecifier.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    const withoutType = trimmed.replace(/^type\s+/, "");
    const isType = forceType || withoutType !== trimmed;
    const parts = withoutType.split(/\s+as\s+/);
    const baseName = parts[0]?.trim();
    if (baseName === undefined || baseName.length === 0) {
        return undefined;
    }

    const aliasName = parts[1]?.trim();
    return {
        aliasName: aliasName === undefined || aliasName.length === 0 ? undefined : aliasName,
        baseName,
        isType,
    };
}

function buildSpecifier({importedName, localName, isType}) {
    const asAlias = localName === undefined ? "" : ` as ${localName}`;
    const typePrefix = isType ? "type " : "";
    return `${typePrefix}${importedName}${asAlias}`;
}

function pushUnique(items, value) {
    if (!items.includes(value)) {
        items.push(value);
    }
}

export const deprecatedMeteoredUtilesConfigImportRule = {
    id: "R026-deprecated-meteored-utiles-config-import",
    summary: "services-comun/modules/utiles/config -> @mr/core-utils/config + @mr/core-workload/config/*",
    apply(content, filePath = "") {
        if (filePath.includes("/@mr/core/dev/patches/")) {
            return {content, replacements: 0};
        }

        let replacements = 0;
        const next = content.replace(
            /import\s+(type\s+)?\{([^}]*)}\s+from\s+(["'])services-comun\/modules\/utiles\/config\3\s*;?/g,
            (statement, importTypeKw, specifiersRaw) => {
                const grouped = new Map();
                const leftovers = [];
                let hasMapped = false;

                const parsedSpecifiers = specifiersRaw
                    .split(",")
                    .map((rawSpecifier) => parseSpecifier(rawSpecifier, {forceType: typeof importTypeKw === "string"}))
                    .filter((parsed) => parsed !== undefined);

                for (const specifier of parsedSpecifiers) {
                    const mapping = SYMBOL_MAP[specifier.baseName];
                    if (mapping === undefined) {
                        pushUnique(leftovers, buildSpecifier({
                            importedName: specifier.baseName,
                            isType: specifier.isType,
                            localName: specifier.aliasName,
                        }));
                        continue;
                    }

                    hasMapped = true;
                    if (!grouped.has(mapping.target)) {
                        grouped.set(mapping.target, []);
                    }

                    const localName = specifier.aliasName ?? (mapping.importedName === specifier.baseName ? undefined : specifier.baseName);
                    const isType = specifier.isType || specifier.baseName.startsWith("I") || mapping.importedName.startsWith("I");
                    pushUnique(grouped.get(mapping.target), buildSpecifier({importedName: mapping.importedName, isType, localName}));
                }

                if (!hasMapped) {
                    return statement;
                }

                replacements += 1;
                const lines = [];

                for (const target of TARGET_ORDER) {
                    const targetSpecifiers = grouped.get(target) ?? [];
                    if (targetSpecifiers.length > 0) {
                        lines.push(`import {${targetSpecifiers.join(", ")}} from "${target}";`);
                    }
                }

                if (leftovers.length > 0) {
                    lines.push(`import {${leftovers.join(", ")}} from "${SOURCE}";`);
                }

                return lines.join("\n");
            },
        );

        return {content: next, replacements};
    },
};
