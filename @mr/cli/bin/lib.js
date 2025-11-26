const {spawn} = require("child_process");

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
