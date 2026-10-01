import classPropertyInitInConstructor from "./rules/class-property-init-in-constructor.js";
import classSectionComments from "./rules/class-section-comments.js";
import configObjectParams from "./rules/config-object-params.js";
import importBlocks from "./rules/import-blocks.js";
import jsdocTypeMembers from "./rules/jsdoc-type-members.js";
import noCrossWorkspaceRelativeImport from "./rules/no-cross-workspace-relative-import.js";
import noReturnsOnVoid from "./rules/no-returns-on-void.js";
import singleAuthorHeader from "./rules/single-author-header.js";
import singleLineSignature from "./rules/single-line-signature.js";

/**
 * Plugin de ESLint con las convenciones de `.github/copilot-instructions.md` que **ninguna regla
 * estándar sabe expresar**: estructura de clases, inicialización de propiedades, forma de las
 * firmas, dónde va la documentación de un tipo y cómo se agrupan los imports.
 *
 * Viene de `eslint-plugin-mrpack`, del repositorio `homeconomy`, donde nació y donde sigue. Aquí
 * se añade `single-author-header`, que allí no hace falta porque no hay envío de framework, y cambian
 * tres cosas: `import-blocks` deduce la lista de workspaces del `package.json` raíz en vez de
 * recibirla escrita, `config-object-params` admite `permitirUltimo`, y la configuración que allí se
 * llamaba `casa` no está en el plugin sino en `config.js`, porque es la del monorepo y no la de las
 * reglas.
 *
 * Dos configuraciones, con criterios distintos a propósito:
 *
 * - `recomendada` — las nueve reglas como `error`, sin ninguna opción rebajada.
 * - `estricta` — añade lo que es **opt-in y no una rebaja**: ordenación alfabética de imports,
 *   firmas de tipos de función, y comentarios de línea y tipos literales en `jsdoc-type-members`.
 *   Son criterios más agresivos que la convención no exige literalmente, no deuda pendiente.
 *
 * Ninguna de las dos es la que se aplica al monorepo: esa es `@mr/core-lint/config`, que parte de
 * las reglas de aquí y decide niveles y excepciones con los números medidos contra el código.
 */
const plugin = {
    meta: {
        name: "@mr/core-lint",
        version: "1.0.0",
    },
    rules: {
        "class-property-init-in-constructor": classPropertyInitInConstructor,
        "class-section-comments": classSectionComments,
        "config-object-params": configObjectParams,
        "import-blocks": importBlocks,
        "jsdoc-type-members": jsdocTypeMembers,
        "no-cross-workspace-relative-import": noCrossWorkspaceRelativeImport,
        "no-returns-on-void": noReturnsOnVoid,
        "single-author-header": singleAuthorHeader,
        "single-line-signature": singleLineSignature,
    },
};

plugin.configs = {
    recomendada: {
        plugins: {"mrpack": plugin},
        rules: {
            "mrpack/class-property-init-in-constructor": "error",
            "mrpack/class-section-comments": "error",
            "mrpack/config-object-params": "error",
            "mrpack/import-blocks": "error",
            "mrpack/jsdoc-type-members": "error",
            "mrpack/no-cross-workspace-relative-import": "error",
            "mrpack/no-returns-on-void": "error",
            "mrpack/single-author-header": "error",
            "mrpack/single-line-signature": "error",
        },
    },
    estricta: {
        plugins: {"mrpack": plugin},
        rules: {
            "mrpack/class-property-init-in-constructor": "error",
            "mrpack/class-section-comments": "error",
            "mrpack/config-object-params": ["error", {incluirTipos: true}],
            "mrpack/import-blocks": ["error", {alfabetico: true}],
            "mrpack/jsdoc-type-members": ["error", {incluirComentariosDeLinea: true, incluirTiposLiterales: true}],
            "mrpack/no-cross-workspace-relative-import": "error",
            "mrpack/no-returns-on-void": "error",
            "mrpack/single-author-header": "error",
            "mrpack/single-line-signature": "error",
        },
    },
};

export default plugin;
