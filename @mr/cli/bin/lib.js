const {spawn} = require("child_process");

// Suprimir DEP0040 (módulo built-in `punycode` deprecado en Node 24).
// Origen: dd-trace y @google-cloud/storage instrumentan / importan node-fetch@2.x,
// que carga whatwg-url@5.0.0 → tr46@0.0.3 → require('punycode').
//
// Suprimir DEP0190 (args con shell:true) en Windows.
// En Windows, yarn es un wrapper .cmd que requiere shell:true para ser resuelto por CreateProcess.
// Los argumentos pasados son siempre literales hardcoded (sin entrada de usuario), por lo que
// el riesgo de inyección es nulo. En Linux/macOS shell:false sigue activo, sin este warning.
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

class Modulo {
    constructor(modulo) {
        this.modulo = modulo;
    }

    async compilar() {
        const time = Date.now();
        console.log("Compilando herramientas...");

        // {
        //     // reinstalar dependencias
        //     const code = await this.spawn("yarn", ["install"]);
        //     if (code != 0) {
        //         return Promise.reject(new Error("Error al instalar dependencias [ yarn install ]"));
        //     }
        // }

        {
            // compilar
            const code = await this.spawn("yarn", ["run", "compile"]);
            if (code != 0) {
                return Promise.reject(new Error("Error al compilar [ yarn @mr/cli run compile ]"));
            }
        }
        console.log("Compilando herramientas... [OK]", Math.round((Date.now()-time)/1000),"sg");
    }

    async ejecutar() {
        try {
            require(`./min/${this.modulo}-run`);
        } catch(err) {
            await this.compilar();
            await this.ejecutar();
        }
    }

    async spawn(cmd, args) {
        const deferred = new Deferred();

        spawn(cmd, args, {stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32"}).on("exit", (code) => {
            deferred.resolve(code);
        });

        return deferred.promise;
    }
}

module.exports = (modulo) => {
    // MRPACK_ROOT lo fija el bin invocante (mrpack.js / mrlang.js) desde __dirname,
    // garantizando que apunta a la raíz del monorepo con independencia del cwd con que
    // Yarn PnP haya arrancado el proceso. El fallback a process.cwd() existe solo como
    // salvaguarda por si lib.js fuera llamado de forma no estándar.
    if (!process.env.MRPACK_ROOT) {
        process.env.MRPACK_ROOT = process.cwd();
    }
    process.chdir(`${__dirname}/..`);
    new Modulo(modulo)
        .ejecutar()
        .catch((err)=>{
            console.error(err.message);
            process.exit(1);
        });
}
