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
 *                                    `__dirname` en este fichero es el de `@mr/core-cli`.
 */
module.exports = ({modulo, workspace, bin}) => {
    // MRPACK_ROOT lo fija el bin invocante desde su propio `__dirname`, así que apunta a la raíz
    // del monorepo con independencia del cwd con que Yarn PnP haya arrancado el proceso. El
    // fallback existe solo por si se llamara de forma no estándar.
    if (!process.env.MRPACK_ROOT) {
        process.env.MRPACK_ROOT = process.cwd();
    }
    process.chdir(`${bin}/..`);

    ejecutar(bin, modulo, workspace)
        .catch((err) => {
            console.error(err.message);
            process.exit(1);
        });
};
