/**
 * Arranque compartido de las dos herramientas de línea de comandos del monorepo.
 *
 * Es **JavaScript plano y CommonJS a propósito**, no TypeScript: lo carga el `bin/*.js` de cada
 * CLI antes de que exista nada compilado, así que no puede depender de un paso de compilación —es
 * justamente quien lo dispara cuando falta—.
 *
 * Lo usaban los dos con una copia cada uno desde que se separaron `mrpack` (`@mr/cli`) y `mrlang`
 * (`@mr/core-i18n`). Aquí hay una sola.
 */
const {spawn} = require("child_process");
const {existsSync} = require("fs");
const {dirname, join} = require("path");

// Suprimir DEP0040 (módulo built-in `punycode` deprecado en Node 24). Origen: dd-trace y
// @google-cloud/storage instrumentan / importan node-fetch@2.x, que carga whatwg-url@5.0.0 →
// tr46@0.0.3 → require('punycode'). Solo le pasa a `mrpack`: son dependencias suyas y llegan por
// `require` en runtime, no por el bundle. Comprobado quitando esta supresión: `mrpack` emite el
// aviso y `mrlang` no.
//
// Suprimir DEP0190 (args con shell:true) en Windows, donde yarn es un wrapper .cmd que
// CreateProcess solo resuelve con shell. Los argumentos de aquí son literales, sin entrada de
// usuario, así que el riesgo de inyección es nulo. En Linux/macOS shell:false sigue activo.
{
    const _emit = process.emit.bind(process);
    const SUPPRESSED = new Set(["DEP0040", "DEP0190"]);
    process.emit = function(event, ...args) {
        if (event === "warning" && SUPPRESSED.has(args[0]?.code)) {
            return true;
        }
        return _emit(event, ...args);
    };
}

// El MaxListenersExceededWarning que `mrpack framework` suelta a puñados —«11 listeners added to
// [PassThrough]»— **no es una fuga**, y por eso se sube el listón en vez de callar el aviso.
//
// Una sola llamada a `file.download()` deja once listeners sobre el mismo PassThrough porque cuatro
// capas encadenan su propio `pipeline()` encima: node-fetch, teeny-request (dos veces),
// `@google-cloud/storage` y los `eos` que Node añade por cada tramo. Son once por fichero y no crecen
// con el tiempo; lo que pasa es que `framework` descarga el `stable.txt` de cada paquete, así que el
// aviso sale una vez por descarga. Comprobado instrumentando `addListener` y volcando las once
// trazas: ninguna de las once es código nuestro.
//
// **Subirlo y no silenciarlo** deja el detector de fugas haciendo su trabajo con otro umbral: algo
// que se desmadre de verdad pasará de veinte y avisará igual. Filtrar el aviso era la otra opción y
// no sale bien: no trae `code`, viene en varios sabores (`error`, `close`) y su traza se corta a diez
// marcos que son **todos** de `node:internal`, así que no hay forma de distinguir por el origen el
// ruido ajeno de una fuga nuestra — solo por el nombre, y eso ya es apagarlo del todo.
require("events").defaultMaxListeners = 20;

class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

function spawnAsync(cmd, args) {
    const deferred = new Deferred();

    spawn(cmd, args, {stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32"}).on("exit", (code) => {
        deferred.resolve(code);
    });

    return deferred.promise;
}

async function compilar(workspace) {
    const time = Date.now();
    console.log("Compilando herramientas...");

    const code = await spawnAsync("yarn", ["run", "compile"]);
    if (code != 0) {
        return Promise.reject(new Error(`Error al compilar [ yarn ${workspace} run compile ]`));
    }

    console.log("Compilando herramientas... [OK]", Math.round((Date.now()-time)/1000), "sg");
}

async function ejecutar(bin, modulo, workspace) {
    try {
        require(`${bin}/min/${modulo}-run`);
    } catch(err) {
        await compilar(workspace);
        await ejecutar(bin, modulo, workspace);
    }
}

/**
 * Sube desde `desde` hasta el directorio que tiene el `yarn.lock`, que es la raíz del monorepo.
 *
 * Es el plan B de `PROJECT_CWD` —lo que exporta Yarn en todo lo que lanza— y existe para cuando el
 * bin se invoca sin pasar por Yarn. Si no encuentra lockfile devuelve el punto de partida en vez de
 * lanzar: un `MRPACK_ROOT` raro todavía es recuperable, y una excepción aquí deja la CLI sin
 * arrancar.
 */
function raizDelMonorepo(desde) {
    let dir = desde;
    while (!existsSync(join(dir, "yarn.lock"))) {
        const padre = dirname(dir);
        if (padre === dir) {
            return desde;
        }
        dir = padre;
    }
    return dir;
}

/**
 * Arranca una CLI: ejecuta su bundle y, si no está, lo compila y reintenta.
 *
 * Compilar aquí no es un lujo: es el único arranque posible en un clon limpio, donde `bin/min/` no
 * existe todavía y no hay ninguna herramienta que pueda generarlo —`mrpack` no puede compilarse a
 * sí mismo antes de arrancar—. Que el bundle esté **viejo**, en cambio, no lo detecta esto sino
 * `mrpack`, comparando el `bin/hash.md5` de cada CLI.
 *
 * @param {object} config
 * @param {string} config.modulo    - Nombre del bundle en `min/`, sin el sufijo `-run`.
 * @param {string} config.workspace - Nombre npm del workspace, solo para el mensaje de error.
 * @param {string} config.bin       - El `__dirname` del `bin/` que llama. No se puede deducir aquí:
 *                                    `__dirname` en este fichero es el de `@mr/core-cli`. Es además
 *                                    el punto de partida desde el que se busca la raíz.
 */
module.exports = ({modulo, workspace, bin}) => {
    // **La raíz del monorepo no se cuenta en `..`, y se resuelve aquí para las dos CLI.** Antes la
    // fijaba cada bin desde su propio `__dirname` contando niveles, y cada uno contaba los suyos
    // porque cuelgan a distinta profundidad. Eso convierte mover un workspace de sitio en un
    // `MRPACK_ROOT` que apunta fuera del repositorio, sin ningún aviso: es exactamente lo que pasó
    // al traer `mrlang` a un monorepo donde su paquete cuelga un nivel más arriba.
    //
    // `PROJECT_CWD` lo exporta Yarn en todo lo que lanza y es el directorio del lockfile. Se respeta
    // un `MRPACK_ROOT` ya puesto por si alguien necesita forzarlo desde fuera.
    if (!process.env.MRPACK_ROOT) {
        process.env.MRPACK_ROOT = process.env.PROJECT_CWD ?? raizDelMonorepo(bin);
    }
    process.chdir(`${bin}/..`);

    ejecutar(bin, modulo, workspace)
        .catch((err) => {
            console.error(err.message);
            process.exit(1);
        });
};
