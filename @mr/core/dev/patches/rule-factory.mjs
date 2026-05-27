/**
 * Factoria de reglas de migracion de imports/exports/require.
 *
 * Todas las reglas de este agente comparten la misma logica de deteccion:
 * - ignorar comentarios (lineas que empiezan por //, /*, *)
 * - actuar solo en sentencias import/export o require(...)
 * - reemplazar un string SOURCE por un string TARGET dentro de la linea
 *
 * Esta libreria centraliza ese patron para evitar duplicacion entre reglas.
 * Anadir una nueva regla simple se reduce a una llamada de dos lineas.
 *
 * ### Esquema de IDs
 *
 * Los IDs usan el formato RXXX-descripcion donde XXX es un numero entero sin
 * limite de digitos. Si se superan las 999 reglas, el ID pasa a ser R1000,
 * R1001... El orden de evaluacion lo controla el array RULES en index.mjs,
 * no el ID, por lo que el salto de digitos no tiene ningun impacto funcional.
 */

/** Regexp que detecta el inicio de un comentario en una linea. */
const COMMENT_RE = /^\s*(\/\/|\/\*|\*)/;

/** Regexp que detecta una sentencia import o export. */
const IMPORT_EXPORT_RE = /^\s*(import|export)\b/;

/** Regexp que detecta una sentencia require(...). */
const REQUIRE_RE = /^\s*(const|let|var)?\s*[^=]*=?\s*require\(/;

/**
 * Regexp que detecta la linea de cierre de un import/export multilinea,
 * p.ej.: `} from "some/module";`
 */
const MULTILINE_CLOSE_RE = /^\s*\}\s+from\s+["']/;

/**
 * Determina si una linea es una sentencia de codigo que puede contener un
 * especificador de modulo (import/export/require) y no es un comentario.
 *
 * Cubre tanto imports de una sola linea como la linea de cierre de un import
 * multilinea (`} from "modulo"`).
 *
 * @param {string} line
 * @returns {boolean}
 */
export function isModuleLine(line) {
    if (COMMENT_RE.test(line)) {
        return false;
    }
    return IMPORT_EXPORT_RE.test(line) || REQUIRE_RE.test(line) || MULTILINE_CLOSE_RE.test(line);
}

/**
 * Colapsa los imports/exports multilinea que contienen `source` en una sola
 * linea para que la logica de procesamiento por lineas pueda trabajar con
 * ellos normalmente.
 *
 * Solo actua sobre bloques que realmente contienen el path buscado, para
 * minimizar el impacto en el resto del contenido.
 *
 * @param {string} content
 * @param {string} source - Substring que debe aparecer en el especificador.
 * @returns {string}
 */
export function collapseMultilineImports(content, source) {
    return content.replace(
        /((?:import|export)(?:\s+type)?\s*\{[^}]*\}\s+from\s+["'][^"']*["'];)/gs,
        (match) => {
            if (!match.includes(source)) {
                return match;
            }
            return match.replace(/\s*\n\s*/g, " ");
        },
    );
}

/**
 * Crea una regla de migracion simple que sustituye SOURCE por TARGET en
 * cualquier sentencia de modulo.
 *
 * @param {object} options
 * @param {string} options.id       - Identificador unico de la regla.
 * @param {string} options.summary  - Descripcion corta para el informe.
 * @param {string} options.source   - Path deprecado a buscar.
 * @param {string} options.target   - Nuevo path al que migrar.
 * @param {string[]} [options.skipIfContains] - Lista de substrings: si la linea
 *   contiene alguno de ellos, se omite (util para excluir subpaths que tienen
 *   su propia regla mas especifica).
 * @returns {{id: string, summary: string, apply: Function}}
 */
export function createSimpleRule({id, summary, source, target, skipIfContains = []}) {
    return {
        id,
        summary,
        apply(content) {
            let replacements = 0;

            const lines = content.split("\n");
            const next = lines.map((line) => {
                if (!isModuleLine(line)) {
                    return line;
                }
                for (const skip of skipIfContains) {
                    if (line.includes(skip)) {
                        return line;
                    }
                }
                if (!line.includes(source)) {
                    return line;
                }
                const replaced = line.replaceAll(source, target);
                if (replaced !== line) {
                    replacements += 1;
                }
                return replaced;
            }).join("\n");

            return {content: next, replacements};
        },
    };
}

/**
 * Crea una regla de reemplazo por regex sobre lineas de codigo.
 *
 * Pensado para migraciones mecanicas que no son solo imports (p.ej. renombrado
 * de llamadas a metodos tras un breaking change).
 *
 * @param {object} options
 * @param {string} options.id       - Identificador unico de la regla.
 * @param {string} options.summary  - Descripcion corta para el informe.
 * @param {string} options.detect   - Substring rapido para filtrar lineas.
 * @param {RegExp} options.regex    - Regex a reemplazar dentro de la linea.
 * @param {string|Function} options.replacement - Reemplazo para String.replace.
 * @param {string[]} [options.skipFilePathIncludes] - Si el filePath contiene alguno,
 *   la regla no se aplica (util para evitar auto-aplicarse sobre patches).
 * @param {boolean} [options.skipComments] - Si true, ignora lineas de comentario.
 * @returns {{id: string, summary: string, apply: Function}}
 */
export function createLineRegexRule({
    id,
    summary,
    detect,
    regex,
    replacement,
    skipFilePathIncludes = [],
    skipComments = true,
}) {
    return {
        id,
        summary,
        apply(content, filePath = "") {
            for (const skipPath of skipFilePathIncludes) {
                if (filePath.includes(skipPath)) {
                    return {content, replacements: 0};
                }
            }

            let replacements = 0;

            const next = content
                .split("\n")
                .map((line) => {
                    if (skipComments && COMMENT_RE.test(line)) {
                        return line;
                    }
                    if (!line.includes(detect)) {
                        return line;
                    }

                    const replaced = line.replace(regex, replacement);
                    if (replaced !== line) {
                        replacements += 1;
                    }
                    return replaced;
                })
                .join("\n");

            return {content: next, replacements};
        },
    };
}

/**
 * Crea una regla de migracion que divide una sentencia de import en varias
 * sentencias, cada una apuntando a un modulo distinto.
 *
 * Util cuando el modulo deprecado re-exportaba simbolos de distintos paquetes.
 *
 * @param {object} options
 * @param {string}   options.id      - Identificador unico de la regla.
 * @param {string}   options.summary - Descripcion corta.
 * @param {string}   options.source  - Path deprecado a buscar.
 * @param {Array<{symbols: string[], target: string, renames?: Record<string, string>}>} options.targets
 *   Lista de grupos: cada grupo declara los symbolos que van a su target.
 *   `renames` permite indicar que un simbolo se llama distinto en el nuevo
 *   paquete, p.ej. `{isBot: "isbot"}` generara `isbot as isBot`.
 * @returns {{id: string, summary: string, apply: Function}}
 */
export function createSplitRule({id, summary, source, targets}) {
    return {
        id,
        summary,
        apply(content) {
            let replacements = 0;

            const lines = collapseMultilineImports(content, source).split("\n");
            const next = lines.map((line) => {
                if (!isModuleLine(line)) {
                    return line;
                }
                if (!line.includes(source)) {
                    return line;
                }

                const isType = /\bimport\s+type\b|\bexport\s+type\b/.test(line);
                const typeKw = isType ? " type" : "";

                const symbolsMatch = line.match(/\{([^}]+)\}/);
                if (symbolsMatch === null) {
                    // No podemos parsear: dejamos la linea sin tocar.
                    return line;
                }

                const importedSymbols = symbolsMatch[1]
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean);

                const parts = [];
                for (const group of targets) {
                    const matched = importedSymbols.filter(sym => {
                        const baseName = sym.split(/\s+as\s+/)[0].trim();
                        return group.symbols.includes(baseName);
                    });

                    if (matched.length === 0) {
                        continue;
                    }

                    const renames = group.renames ?? {};
                    const rewritten = matched.map(sym => {
                        const baseName = sym.split(/\s+as\s+/)[0].trim();
                        const alias = sym.includes(" as ") ? sym.split(/\s+as\s+/)[1].trim() : null;
                        const newName = renames[baseName] ?? baseName;

                        if (newName !== baseName) {
                            // El simbolo tiene un nombre distinto en el nuevo paquete.
                            const finalAlias = alias ?? baseName;
                            return `${newName} as ${finalAlias}`;
                        }
                        return alias ? `${baseName} as ${alias}` : baseName;
                    });

                    parts.push(`import${typeKw} {${rewritten.join(", ")}} from "${group.target}";`);
                }

                if (parts.length === 0) {
                    return line;
                }

                replacements += 1;
                return parts.join("\n");
            }).join("\n");

            return {content: next, replacements};
        },
    };
}

