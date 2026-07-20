import {isModuleLine} from "../rule-factory.mjs";

// Matches a pure default import (with or without the `type` keyword):
//   import Foo from "@mr/user-tiempo-domain";
//   import type Foo from "@mr/user-tiempo-domain";
const PURE_DEFAULT_RE = /^(\s*)import\s+(type\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+(["'])@mr\/user-tiempo-domain\4\s*;?/;

// Matches a mixed default+named import:
//   import Foo, {Bar} from "@mr/user-tiempo-domain";
const MIXED_DEFAULT_RE = /^(\s*)import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*\{([^}]*)\}\s+from\s+(["'])@mr\/user-tiempo-domain\4\s*;?/;

export const breakingUserTiempoDomainDefaultImportRule = {
    id: "R032-breaking-user-tiempo-domain-default-import",
    summary: "import Foo from @mr/user-tiempo-domain -> import {Dominio as Foo} from @mr/user-tiempo-domain",
    apply(content) {
        let replacements = 0;

        const lines = content.split("\n");
        const next = lines.map((line) => {
            if (!isModuleLine(line)) {
                return line;
            }
            if (!line.includes("@mr/user-tiempo-domain")) {
                return line;
            }

            // Mixed default+named: import Foo, {Bar} -> import {Dominio as Foo, Bar}
            const mixedMatch = MIXED_DEFAULT_RE.exec(line);
            if (mixedMatch !== null) {
                const [, indent, defaultName, namedSpecifiers] = mixedMatch;
                const trimmedSpecifiers = namedSpecifiers.trim();
                replacements += 1;
                return `${indent}import {Dominio as ${defaultName}, ${trimmedSpecifiers}} from "@mr/user-tiempo-domain";`;
            }

            // Pure default: import Foo -> import {Dominio as Foo}
            const pureMatch = PURE_DEFAULT_RE.exec(line);
            if (pureMatch !== null) {
                const [, indent, typeKw, defaultName] = pureMatch;
                const typePrefix = typeof typeKw === "string" && typeKw.trim().length > 0 ? "type " : "";
                replacements += 1;
                return `${indent}import ${typePrefix}{Dominio as ${defaultName}} from "@mr/user-tiempo-domain";`;
            }

            return line;
        }).join("\n");

        return {content: next, replacements};
    },
};

