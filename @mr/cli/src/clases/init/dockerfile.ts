/**
 * Editor: Bixus
 * Fecha: Thu, 29 Oct 2026 07:47:56 GMT
 * Hash: 8b50720d671f8be466cbf34fe700a85c
 * Versión: 2026.10.29+1-bixus
 * Proyecto: https://github.com/alpred/tiempo-web-estaticos.git
 */

/**
 * Instrucción con la que los Dockerfile de `@mr/cli/deployment/std` preparan Yarn. Desde Node 25 la
 * imagen oficial de Node no trae ni `yarn` ni `corepack`, así que antes de habilitarlo hay que
 * instalarlo con npm.
 */
export const COREPACK = "RUN npm install -g corepack && corepack enable && corepack prepare yarn@latest --activate";

/**
 * Asegura que cada etapa de un Dockerfile que usa Yarn prepara Yarn con corepack ({@link COREPACK}).
 *
 * Una etapa que ya tiene `corepack enable` sin el `npm install -g corepack` delante (la primera
 * versión del cambio) se corrige en su sitio. Si no lo tiene, la instrucción se inserta tras
 * `RUN apk add --no-cache tzdata` si la etapa lo tiene, o si no, tras su primer `WORKDIR`, o si
 * tampoco hay, tras el `FROM`. Las etapas que no mencionan `yarn` no se tocan: pueden partir de una
 * imagen sin npm.
 *
 * @param contenido - Contenido del Dockerfile.
 * @returns El contenido parcheado; idéntico al de entrada si no hacía falta nada.
 */
export function parchearCorepack(contenido: string): string {
    return contenido.split(/^(?=FROM\s)/m).map((etapa) => {
        if (!/^FROM\s/.test(etapa) || !etapa.includes("yarn") || etapa.includes(COREPACK)) {
            return etapa;
        }
        const legacy = /^RUN corepack enable.*$/m;
        if (legacy.test(etapa)) {
            return etapa.replace(legacy, COREPACK);
        }
        const ancla = etapa.match(/^RUN apk add --no-cache tzdata\n/m) ?? etapa.match(/^WORKDIR .*\n/m) ?? etapa.match(/^FROM .*\n/m);
        if (ancla?.index===undefined) {
            return `${etapa}\n${COREPACK}\n`;
        }
        const corte = ancla.index + ancla[0].length;

        return `${etapa.slice(0, corte)}${COREPACK}\n${etapa.slice(corte)}`;
    }).join("");
}
