/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 9d3a56ed51a95239e0045f553926b279
 * Versión: 2026.11.13+1-bixus
 * Anterior: 2026.11.9+8-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Instrucción con la que cada etapa que usa Yarn instala y habilita corepack. Desde Node 25 la imagen
 * oficial de Node no trae ni `yarn` ni `corepack`, así que antes de habilitarlo hay que instalarlo con
 * npm. Es la misma que llevan los Dockerfile de `@mr/cli/deployment/std`.
 */
export const COREPACK = "RUN npm install -g corepack && corepack enable";

/**
 * Caché de corepack en una ruta fija de la imagen final, y no bajo `$HOME`: si el pod arranca con otro
 * usuario u otro `HOME` que el build, corepack no encontraría el Yarn preparado y lo descargaría.
 */
export const COREPACK_HOME = "ENV COREPACK_HOME=/usr/local/share/corepack";

/**
 * Prepara en la caché de corepack la versión exacta del `packageManager` del `package.json` raíz. Va
 * detrás del `COPY` de ese `package.json`, para que la capa se rehaga cuando cambie la versión.
 */
export const COREPACK_INSTALL = "RUN corepack install";

/**
 * {@link COREPACK_INSTALL} de la etapa final, la que arranca el pod: además comprueba sin red que Yarn
 * arranca, para que falle el build y no el pod si corepack fuera a descargar algo.
 */
export const COREPACK_INSTALL_FINAL = "RUN corepack install && COREPACK_ENABLE_NETWORK=0 yarn --version";

/**
 * Compilador en la etapa que instala las dependencias, para los módulos nativos que no traen binario
 * para musl (hoy, `bufferutil` en arm64: el suyo pide el cargador de glibc). Solo va en una etapa
 * intermedia, que se descarta, así que la imagen final no crece.
 */
export const COMPILADOR = "RUN apk add --no-cache build-base python3";

/** Una etapa que instala las dependencias con Yarn. */
const INSTALA_DEPENDENCIAS = /^RUN .*\byarn (?:workspaces focus|install)\b/m;

const COMENTARIO_FINAL = "# Yarn ya preparado en la imagen, para que el pod no lo descargue al arrancar: ver «Yarn ya preparado\n# en la imagen» en @mr/cli/deployment/README.md.";

/**
 * Las formas de habilitar corepack que han escrito las versiones anteriores de este parche (con o sin
 * `npm install -g corepack`, con o sin `corepack prepare <versión> --activate`). Se sustituyen enteras
 * por {@link COREPACK}. Cualquier otra línea con `corepack enable` es de alguien y no se toca.
 */
const COREPACK_CONOCIDO = /^RUN (?:npm install -g corepack && )?corepack enable(?: && corepack prepare \S+(?: --activate)?)?[ \t]*$/m;

/** Un `corepack install` escrito por este parche, en cualquiera de sus dos formas. */
const INSTALL_CONOCIDO = /^RUN corepack install(?: && COREPACK_ENABLE_NETWORK=0 yarn --version)?[ \t]*$/m;

/**
 * Un `COPY` que deja el `package.json` raíz en el directorio de trabajo: `COPY package.json ./`,
 * `COPY ./package.json ./yarn.lock ./`… No casa con el de un workspace (`./${RUTA}/${WS}/package.json`)
 * ni con los `COPY --from=`.
 */
const COPY_PACKAGE_JSON = /^COPY[ \t]+(?!--from)(?:\S+[ \t]+)*?(?:\.\/)?package\.json[ \t]+(?:\S+[ \t]+)*?\.\/?[ \t]*$/gm;

/**
 * Resultado de {@link parchearCorepack}.
 *
 * @property contenido - El Dockerfile parcheado; idéntico al de entrada si no hacía falta nada.
 * @property avisos    - Lo que no se ha podido dejar como en los Dockerfile estándar, para que lo
 *                       revise una persona. Vacío si todo ha ido bien.
 */
export interface IParcheCorepack {
    contenido: string;
    avisos: string[];
}

/**
 * Inserta `línea` justo detrás de la coincidencia `ancla` de `texto`.
 *
 * @param texto - Texto en el que insertar.
 * @param ancla - Coincidencia de una expresión de una línea entera, salto incluido o no.
 * @param linea - Lo que se inserta, sin salto final.
 * @returns El texto con la línea insertada.
 */
function insertarTras(texto: string, ancla: RegExpMatchArray, linea: string): string {
    const fin = (ancla.index ?? 0) + ancla[0].length;
    if (texto[fin]==="\n") {
        return `${texto.slice(0, fin + 1)}${linea}\n${texto.slice(fin + 1)}`;
    }

    return `${texto.slice(0, fin)}\n${linea}${texto.slice(fin)}`;
}

/**
 * Deja una etapa que usa Yarn preparada como las de los Dockerfile estándar.
 *
 * @param etapa - Texto de la etapa, desde su `FROM`.
 * @param num - Número de la etapa (desde 1), para los avisos.
 * @param final - Si es la última del Dockerfile, la que arranca el pod.
 * @param alpine - Si el Dockerfile usa `apk`, es decir, parte de una imagen Alpine.
 * @param avisos - Donde se acumulan los avisos.
 * @returns La etapa parcheada.
 */
function parchearEtapa(etapa: string, num: number, final: boolean, alpine: boolean, avisos: string[]): string {
    // 1. corepack instalado y habilitado.
    if (COREPACK_CONOCIDO.test(etapa)) {
        etapa = etapa.replace(COREPACK_CONOCIDO, COREPACK);
    } else if (etapa.includes("corepack enable")) {
        avisos.push(`Etapa ${num}: habilita corepack de una forma que no reconozco; no se toca. Revisa que prepare Yarn con \`corepack install\` como los Dockerfile de @mr/cli/deployment/std.`);
        return etapa;
    } else {
        const ancla = etapa.match(/^RUN apk add --no-cache tzdata[ \t]*$/m) ?? etapa.match(/^WORKDIR .*$/m) ?? etapa.match(/^FROM .*$/m);
        etapa = ancla===null ? `${etapa}\n${COREPACK}\n` : insertarTras(etapa, ancla, COREPACK);
    }

    // 2. En la etapa intermedia que instala las dependencias, el compilador. En la final no: engordaría la imagen.
    if (alpine && INSTALA_DEPENDENCIAS.test(etapa) && !etapa.includes("build-base")) {
        if (final) {
            avisos.push(`Etapa ${num}: instala las dependencias en la etapa final; no se le añade compilador para no engordar la imagen, así que en arm64 \`bufferutil\` se quedará en JavaScript. Pásalo a una etapa de build como los Dockerfile de @mr/cli/deployment/std.`);
        } else {
            const ancla = etapa.match(/^RUN npm install -g corepack && corepack enable$/m);
            if (ancla!==null) {
                etapa = insertarTras(etapa, ancla, COMPILADOR);
            }
        }
    }

    // 3. En la etapa final, la caché de corepack en una ruta fija.
    if (final && !/^ENV COREPACK_HOME=/m.test(etapa)) {
        const ancla = etapa.match(/^RUN npm install -g corepack && corepack enable$/m);
        if (ancla!==null) {
            etapa = insertarTras(etapa, ancla, COREPACK_HOME);
        }
    }

    // 4. La versión de `packageManager` preparada detrás del `COPY` del `package.json` raíz.
    const install = final ? COREPACK_INSTALL_FINAL : COREPACK_INSTALL;
    if (INSTALL_CONOCIDO.test(etapa)) {
        return etapa.replace(INSTALL_CONOCIDO, install);
    }
    if (/^RUN .*corepack install/m.test(etapa)) {
        return etapa;
    }
    const copias = [...etapa.matchAll(COPY_PACKAGE_JSON)];
    const ultima = copias.at(-1);
    if (ultima===undefined) {
        avisos.push(`Etapa ${num}: no copia el package.json raíz al directorio de trabajo, así que no se puede preparar Yarn con \`corepack install\`${final ? " y el pod lo descargará al arrancar" : ""}. Revísala a mano.`);
        return etapa;
    }

    return insertarTras(etapa, ultima, final ? `${COMENTARIO_FINAL}\n${install}` : install);
}

/**
 * Deja cada etapa de un Dockerfile propio que usa Yarn preparada como las de los Dockerfile de
 * `@mr/cli/deployment/std`, para que el pod no descargue Yarn al arrancar:
 *
 * 1. {@link COREPACK} tras `RUN apk add --no-cache tzdata`, o si no hay, tras su primer `WORKDIR`, o si
 *    tampoco, tras el `FROM`. Si la etapa ya habilitaba corepack con alguna de las formas que escribían
 *    las versiones anteriores de este parche (`corepack prepare yarn@latest --activate` incluido), se
 *    sustituye en su sitio.
 * 2. En una etapa intermedia que instala las dependencias (`yarn workspaces focus` o `yarn install`),
 *    {@link COMPILADOR} justo detrás, si el Dockerfile es de Alpine (usa `apk`). Si las instala la etapa
 *    final, no se añade y se avisa.
 * 3. En la etapa final, {@link COREPACK_HOME} justo detrás de {@link COREPACK}.
 * 4. {@link COREPACK_INSTALL} detrás del último `COPY` del `package.json` raíz; en la etapa final,
 *    {@link COREPACK_INSTALL_FINAL}.
 *
 * Las etapas que no mencionan `yarn` no se tocan: pueden partir de una imagen sin npm. Una etapa que
 * habilita corepack de otra forma, o que no copia el `package.json` raíz, se deja como está y se avisa.
 * Aplicarlo dos veces no cambia nada.
 *
 * @param contenido - Contenido del Dockerfile.
 * @returns El contenido parcheado y los avisos.
 */
export function parchearCorepack(contenido: string): IParcheCorepack {
    const avisos: string[] = [];
    const trozos = contenido.split(/^(?=FROM\s)/m);
    const alpine = /^RUN .*\bapk add\b/m.test(contenido);
    let num = 0;
    const parcheado = trozos.map((etapa, i) => {
        if (!/^FROM\s/.test(etapa)) {
            return etapa;
        }
        num++;
        if (!etapa.includes("yarn")) {
            return etapa;
        }

        return parchearEtapa(etapa, num, i===trozos.length - 1, alpine, avisos);
    }).join("");

    return {contenido: parcheado, avisos};
}

/**
 * Comentario que acompaña a la línea de arranque de `run.sh`, el mismo que llevan los Dockerfile de
 * `@mr/cli/deployment/std`.
 */
export const COMENTARIO_ARRANQUE = [
    "# El PID 1 tiene que ser Yarn, que sí reenvía SIGTERM a su hijo. Sin `exec` lo era `sh`, que ignora SIGTERM (al PID 1",
    "# el kernel no le aplica la acción por defecto de una señal sin handler); y con `exec yarn` lo es el shim de corepack,",
    "# que con `yarnPath` lanza el Yarn del repo como proceso hijo y tampoco reenvía la señal. Las dos cosas medidas en",
    "# svc-status el 2026-11-12: Node no se enteraba del apagado y moría por SIGKILL al acabar la gracia. Por eso se arranca",
    "# `node <yarnPath>` directamente; sin `yarnPath` en el `.yarnrc.yml` se queda `yarn`.",
].join("\n");

/**
 * La línea de `run.sh` que arranca el servicio, como en los Dockerfile de `@mr/cli/deployment/std`: `exec node <yarnPath>`
 * con el `yarnPath` del `.yarnrc.yml` leído al construir la imagen, o `exec yarn` si no lo hay.
 *
 * @param resto - Lo que va detrás de `workspace ${WS}` (`node --no-warnings app.js`, `run next start -p 8080`…).
 * @returns La instrucción `RUN`.
 */
export function lineaArranque(resto: string): string {
    return `RUN Y="$(sed -n 's/^yarnPath:[[:space:]]*//p' .yarnrc.yml | tr -d "\\"' \\r")" && echo "exec \${Y:+node }\${Y:-yarn} workspace \${WS} ${resto}" >> run.sh`;
}

/** La línea de `run.sh` que escribían los Dockerfile estándar antes, con o sin `exec`. */
const ARRANQUE_ANTIGUO = /^RUN echo "(?:exec )?yarn workspace \$\{WS\} ([^"\n]+)" >> run\.sh[ \t]*$/m;

/** La línea de arranque que deja {@link lineaArranque}, o una que ya arranca `node <yarnPath>` por su cuenta. */
const ARRANQUE_BUENO = /\$\{Y:\+node \}|^RUN .*exec node \S*\.yarn\/releases\//m;

/**
 * Deja el arranque de la etapa final de un Dockerfile propio como el de los Dockerfile de `@mr/cli/deployment/std`, para que
 * SIGTERM llegue a Node: la línea `RUN echo "yarn workspace ${WS} …" >> run.sh` (con o sin `exec`) pasa a ser
 * {@link lineaArranque}, precedida de {@link COMENTARIO_ARRANQUE}.
 *
 * Si la etapa final arranca con Yarn de otra forma (`CMD yarn …`, un `ENTRYPOINT` propio, otro `run.sh`), no se toca y se avisa.
 * Aplicarlo dos veces no cambia nada.
 *
 * @param contenido - Contenido del Dockerfile.
 * @returns El contenido parcheado y los avisos, con la misma forma que {@link parchearCorepack}.
 */
export function parchearArranque(contenido: string): IParcheCorepack {
    const etapas = contenido.split(/^(?=FROM\s)/m);
    const final = etapas.at(-1) ?? "";
    const num = etapas.filter((e) => /^FROM\s/.test(e)).length;
    if (!/^FROM\s/.test(final) || ARRANQUE_BUENO.test(final)) {
        return {contenido, avisos: []};
    }

    const antigua = final.match(ARRANQUE_ANTIGUO);
    if (antigua!==null) {
        etapas[etapas.length - 1] = final.replace(ARRANQUE_ANTIGUO, `${COMENTARIO_ARRANQUE}\n${lineaArranque(antigua[1])}`);
        return {contenido: etapas.join(""), avisos: []};
    }

    if (/^(?:CMD|ENTRYPOINT)\b.*(?:\byarn\b|run\.sh)/m.test(final)) {
        return {contenido, avisos: [`Etapa ${num}: no reconozco cómo arranca el servicio, así que no se toca. Para que SIGTERM llegue a Node, el PID 1 tiene que ser Yarn (\`exec node <yarnPath> workspace …\`), ni \`sh\` ni el shim de corepack: revísalo a mano como en @mr/cli/deployment/std/Dockerfile.`]};
    }

    return {contenido, avisos: []};
}
