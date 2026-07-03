import {collapseMultilineImports, isModuleLine} from "../rule-factory.mjs";

const SOURCE = "services-comun-meteored/modules/portal/tiempo";
const TARGET = "@mr/user-tiempo-domain";

/**
 * Regla R030: migra los imports de la raiz de `services-comun-meteored/modules/portal/tiempo`
 * a `@mr/user-tiempo-domain`, preservando `TPlataforma` en el path original.
 *
 * Casos:
 * - Solo `TPlataforma`          → sin cambios (TPlataforma se mantiene en el path original).
 * - Solo otros simbolos         → cambia el path a TARGET.
 * - `TPlataforma` + otros       → divide en dos sentencias: TPlataforma queda en SOURCE,
 *                                 el resto se mueve a TARGET.
 * - Import por defecto / efecto → cambia el path a TARGET.
 *
 * Los subpaths `/dominios/` y `/loader` son gestionados por R028/R029 respectivamente.
 */
export const deprecatedPortalTiempoImportRule = {
    id: "R030-deprecated-portal-tiempo-import",
    summary: "services-comun-meteored/modules/portal/tiempo -> @mr/user-tiempo-domain (preserva TPlataforma)",
    apply(content) {
        let replacements = 0;

        const lines = collapseMultilineImports(content, SOURCE).split("\n");
        const next = lines.map((line) => {
            if (!isModuleLine(line)) {
                return line;
            }
            if (!line.includes(SOURCE)) {
                return line;
            }
            // Subpaths ya gestionados por R028/R029 (salvaguarda por si el orden cambia).
            if (line.includes("tiempo/dominios/") || line.includes("tiempo/loader")) {
                return line;
            }

            const isType = /\bimport\s+type\b/.test(line);
            const typeKw = isType ? " type" : "";

            const symbolsMatch = line.match(/\{([^}]+)\}/);
            if (symbolsMatch === null) {
                // Import por defecto o side-effect: cambiar solo el path.
                const newLine = line.replace(SOURCE, TARGET);
                if (newLine !== line) {
                    replacements += 1;
                }
                return newLine;
            }

            const importedSymbols = symbolsMatch[1]
                .split(",")
                .map(s => s.trim())
                .filter(Boolean);

            const keepInOld = importedSymbols.filter(sym => sym.split(/\s+as\s+/)[0].trim() === "TPlataforma");
            const moveToNew = importedSymbols.filter(sym => sym.split(/\s+as\s+/)[0].trim() !== "TPlataforma");

            if (keepInOld.length === 0) {
                // Sin TPlataforma: cambiar el path directamente.
                const newLine = line.replace(SOURCE, TARGET);
                if (newLine !== line) {
                    replacements += 1;
                }
                return newLine;
            }

            if (moveToNew.length === 0) {
                // Solo TPlataforma: dejar sin cambios.
                return line;
            }

            // Mezcla: dividir en dos sentencias.
            replacements += 1;
            return [
                `import${typeKw} {${keepInOld.join(", ")}} from "${SOURCE}";`,
                `import${typeKw} {${moveToNew.join(", ")}} from "${TARGET}";`,
            ].join("\n");
        });

        return {content: next.join("\n"), replacements};
    },
};

