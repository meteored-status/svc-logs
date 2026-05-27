const {spawn} = require("child_process");

// Suprimir DEP0040 (módulo built-in `punycode` deprecado en Node 24).
// Origen: dd-trace y @google-cloud/storage instrumentan / importan node-fetch@2.7.0,
// que carga whatwg-url@5.0.0 → tr46@0.0.3 → require('punycode').
// Actualizar tr46@0.0.3 requeriría romper node-fetch@2.x (dependencia de gaxios/teeny-request).
{
    const _emit = process.emit.bind(process);
    process.emit = function(event, ...args) {
        if (event === "warning" && args[0]?.code === "DEP0040") {
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

        spawn(cmd, args, {stdio: ["ignore", "ignore", "inherit"]}).on("exit", (code) => {
            deferred.resolve(code);
        });

        return deferred.promise;
    }
}

module.exports = (modulo) => {
    process.chdir(`${__dirname}/..`);
    new Modulo(modulo)
        .ejecutar()
        .catch((err)=>{
            console.error(err.message);
            process.exit(1);
        });
}
