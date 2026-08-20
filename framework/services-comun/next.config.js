const fs = require("node:fs");
const {createHash} = require("node:crypto");

const md5 = (data)=>{
    return createHash('md5').update(data).digest("hex")
}

/**
 * Hash del contenido de un fichero o, recursivamente, de un directorio.
 *
 * Devuelve `undefined` si la ruta no existe, en vez de tumbar la compilación: `buildDirs` puede
 * incluir ficheros que solo están en algunos entornos —`.env.local` lo trae el despliegue desde las
 * credenciales y no está en el repositorio—, y con un `statSync` a secas un fichero ausente rompía
 * `next build` entero.
 *
 * Ojo al tocar el cálculo: el resultado es el `buildId` de Next, y de él depende que el despliegue
 * detecte que un workspace ha cambiado. Cualquier cambio en cómo se combinan los hashes mueve el
 * `buildId` de todos los proyectos a la vez, y eso fuerza una imagen nueva de cada uno.
 */
const hashDir = (dir) => {
    const stat = fs.statSync(dir, {throwIfNoEntry: false});
    if (stat===undefined) {
        return undefined;
    }

    const hashes = [];

    if (stat.isDirectory()) {
        for (const file of fs.readdirSync(dir)) {
            const path = `${dir}/${file}`;
            const hijo = fs.statSync(path, {throwIfNoEntry: false});
            if (hijo===undefined) {
                continue;
            }
            if (hijo.isDirectory()) {
                hashes.push(hashDir(path));
            } else {
                hashes.push(md5(fs.readFileSync(path)));
            }
        }
    } else {
        hashes.push(md5(fs.readFileSync(dir)));
    }

    return md5(hashes.join(''));
}

let ok = false;

module.exports = function (buildDirs) {
    const salida = {
        compress: false,
        distDir: 'output',
        poweredByHeader: false,
        reactStrictMode: true,
        rewrites: async () => {
            return [
                {
                    source: '/admin/:path*',
                    destination: '/api/admin/:path*'
                }
            ];
        },
        // trailingSlash: true,
        webpack: (config, { dev, isServer, webpack }) => {
            // if (isServer && dev && !ok) {
            //     ok = true;
            //     const {TsCheckerRspackPlugin} = require('ts-checker-rspack-plugin');
            //     config.plugins.push(new TsCheckerRspackPlugin({
            //         typescript: {
            //             configFile: `tsconfig.json`,
            //         },
            //     }));
            // }

            const entorno = dev?"desarrollo":(process.env.ENV??"test");
            const desarrollo = dev;

            config.plugins.push(new webpack.DefinePlugin({
                DESARROLLO: JSON.stringify(entorno==="desarrollo"),
                TEST: JSON.stringify(entorno==="test"),
                PRODUCCION: JSON.stringify(!desarrollo),
                ENTORNO: JSON.stringify(entorno),
                NEXTJS: JSON.stringify(true),

                "global.DESARROLLO": JSON.stringify(entorno==="desarrollo"),
                "global.TEST": JSON.stringify(entorno==="test"),
                "global.PRODUCCION": JSON.stringify(!desarrollo),
                "global.ENTORNO": JSON.stringify(entorno),
                "global.NEXTJS": JSON.stringify(true),
            }));

            config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, res => {
                res.request = res.request.replace(/^node:/, "");
            }));

            return config
        }
    }

    if (buildDirs && buildDirs.length) {
        // Las entradas que no existen no suman nada, pero en cuanto aparecen cambian el `buildId`:
        // es lo que hace que el despliegue detecte, por ejemplo, que el build ya lleva `.env.local`.
        salida.generateBuildId = async () => md5(buildDirs.map(d => hashDir(d)).filter(hash => hash!==undefined).join(''))
    }

    return salida;
}
