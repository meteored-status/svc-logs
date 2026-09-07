import fs from "node:fs/promises";
import path from "node:path";

import {createWorkspaceRule} from "../rule-factory.mjs";

const CORE_I18N = "@mr/core-i18n";
const SERVICES_COMUN = "services-comun";
const CAMPOS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** Si el proyecto genera con v2, leido de su propio script `generate`. */
function esV2(generate) {
    return typeof generate === "string" && /(?:^|\s)(?:-v\s*2|--version[=\s]2)(?:\s|$)/.test(generate);
}

/**
 * Regla WS002: pone al dia el workspace `i18n/` de un proyecto.
 *
 * Hace dos cosas, las dos porque el runtime de traducciones v2 se mudo de `services-comun` a
 * `@mr/core-i18n`:
 *
 * 1. **Declara `@mr/core-i18n`.** WS001 no puede: deduce las dependencias de los imports escritos
 *    en disco, y las reglas de fichero saltan `i18n/` a proposito por ser un arbol generado, asi
 *    que hasta la primera regeneracion no hay import que detectar. Sin esto, tras actualizar el
 *    framework la compilacion falla con `Cannot find module "@mr/core-i18n/literal"`.
 * 2. **Quita `services-comun`, pero solo en proyectos v2.** El codigo que genera v2 no menciona el
 *    paquete en ningun punto; el de v1 si —importa su runtime de traducciones—, asi que ahi se
 *    deja. Con la dependencia se va tambien el `extends` del `tsconfig.json`, que apuntaba a
 *    `services-comun/tsconfig.json`: son inseparables, quitar una sin la otra deja el tsconfig sin
 *    resolver. El destino es `@mr/core-i18n/tsconfig.json`, que el workspace ya necesita.
 *
 * Idempotente: no toca nada si ya esta como debe.
 */
export const ensureI18nCoreDevDepRule = createWorkspaceRule({
    id: "WS002-ensure-i18n-core-devdep",
    summary: `El workspace i18n/ declara ${CORE_I18N}, y suelta ${SERVICES_COMUN} si genera con v2`,
    async run(rootDir) {
        const dir = path.join(rootDir, "i18n");
        const manifiesto = path.join(dir, "package.json");

        const crudo = await fs.readFile(manifiesto, "utf8").catch(() => null);
        if (crudo === null) {
            // El proyecto no tiene workspace de traducciones. Nada que hacer.
            return {changed: 0};
        }

        const pkg = JSON.parse(crudo);
        let changed = 0;

        if (!CAMPOS.some((campo) => pkg[campo]?.[CORE_I18N] !== undefined)) {
            pkg.devDependencies = {...pkg.devDependencies, [CORE_I18N]: "workspace:*"};
            changed += 1;
        }

        if (esV2(pkg.scripts?.generate)) {
            for (const campo of CAMPOS) {
                if (pkg[campo]?.[SERVICES_COMUN] !== undefined) {
                    delete pkg[campo][SERVICES_COMUN];
                    changed += 1;
                }
            }

            const tsconfig = path.join(dir, "tsconfig.json");
            const crudoTs = await fs.readFile(tsconfig, "utf8").catch(() => null);
            if (crudoTs !== null) {
                const config = JSON.parse(crudoTs);
                if (config.extends === `${SERVICES_COMUN}/tsconfig.json`) {
                    config.extends = `${CORE_I18N}/tsconfig.json`;
                    await fs.writeFile(tsconfig, `${JSON.stringify(config, null, 2)}\n`, "utf8");
                    changed += 1;
                }
            }
        }

        if (changed === 0) {
            return {changed: 0};
        }

        pkg.devDependencies = Object.fromEntries(
            Object.entries(pkg.devDependencies ?? {}).sort(([a], [b]) => a.localeCompare(b)),
        );
        await fs.writeFile(manifiesto, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

        return {changed};
    },
});
