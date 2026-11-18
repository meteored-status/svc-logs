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

/**
 * Extensiones que Next acepta para `instrumentation` en la raíz del proyecto. Es la misma lista que `mrpack init`
 * (`CANDIDATOS_INSTRUMENTATION` en `@mr/cli`), que además mira `src/` y avisa de que ahí no se vigila.
 */
const EXTENSIONES_INSTRUMENTACION = ['ts', 'js', 'tsx', 'jsx', 'mts', 'mjs', 'cts', 'cjs'];

/**
 * Lo que, además de lo que declara el proyecto, entra en el hash del `buildId` de un proyecto que tiene
 * `instrumentation.*` (el arranque del heartbeat de pods, `@mr/core-workload/heartbeat/next`): el cierre de imports del emisor, y
 * solo eso (de la red, `index.ts`, el cliente y los metadatos de WebSocket y `server/http/config`), para no hashear `README`, `CHANGELOG`,
 * `spec` ni `tmp`, ni el resto de `@mr/core/network`. Sin esto, un cambio en el emisor no movía el `buildId`,
 * `mrpack` daba el workspace por «Sin cambios» y no había imagen nueva.
 *
 * Lo comprueba `spec/next-config.spec.ts`, que calcula el cierre de imports real: si el emisor importa algo de otro sitio, falla.
 */
const DIRS_HEARTBEAT = [
    '../../@mr/core/workload/heartbeat',
    '../../@mr/core/workload/config',
    '../../@mr/core/workload/engine',
    '../../@mr/core/network/index.ts',
    '../../@mr/core/network/client/websocket',
    '../../@mr/core/network/metadata/websocket',
    '../../@mr/core/network/server/http/config',
    '../../@mr/core/dev/manifest',
    '../../@mr/core/log/modules',
    '../../framework/services-comun/modules/utiles',
];

/**
 * Si `dir` ya está en `lista` o dentro de uno de sus directorios (p. ej. `../../@mr/core/network` ya cubre
 * `../../@mr/core/network/client`). No hace falta hashearlo dos veces.
 */
const cubierto = (dir, lista) => lista.some(d => {
    const base = d.replace(/\/+$/, '');

    return dir === d || dir === base || dir.startsWith(`${base}/`);
});

/**
 * Los directorios que entran en el hash del `buildId`: los del proyecto y, **solo si existe `./instrumentation.*`**, ese fichero y
 * los del emisor del heartbeat (los que el proyecto no tenga ya). La condición evita cambiar el `buildId` de los proyectos que no
 * usan el heartbeat: ese cambio fuerza una imagen nueva, y no hay motivo para dársela a quien no lleva el emisor.
 *
 * Las rutas son relativas al directorio de trabajo (el del proyecto), como las demás de `buildDirs`.
 *
 * @param buildDirs - Los del proyecto.
 * @param existe - Comprueba si existe una ruta. Por defecto `fs.existsSync`.
 */
const dirsDeBuild = (buildDirs, existe = fs.existsSync) => {
    const instrumentacion = EXTENSIONES_INSTRUMENTACION.map(ext => `./instrumentation.${ext}`).find(ruta => existe(ruta));
    if (instrumentacion === undefined) {
        return buildDirs;
    }
    const salida = [...buildDirs];
    for (const dir of [instrumentacion, ...DIRS_HEARTBEAT]) {
        if (!cubierto(dir, salida)) {
            salida.push(dir);
        }
    }

    return salida;
}

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
        // Los directorios se resuelven al llamar, no al construir: `instrumentation.ts` es del directorio de trabajo.
        salida.generateBuildId = async () => md5(dirsDeBuild(buildDirs).map(d => hashDir(d)).filter(hash => hash!==undefined).join(''))
    }

    return salida;
}

// No enumerable: hay `next.config.deps.js` que hacen `{...base, ...custom}`, y una clave más en la configuración de Next da
// «Unrecognized key(s) in object: 'dirsDeBuild'» en cada arranque.
Object.defineProperty(module.exports, 'dirsDeBuild', {value: dirsDeBuild, enumerable: false});
