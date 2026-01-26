const fs = require("node:fs");
const {createHash} = require("node:crypto");

const md5 = (data)=>{
    return createHash('md5').update(data).digest("hex")
}

const hashDir = (dir) => {
    const hashes = [];

    if (fs.statSync(dir).isDirectory()) {
        for (const file of fs.readdirSync(dir)) {
            const path = `${dir}/${file}`;
            if (fs.statSync(path).isDirectory()) {
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
            if (isServer && dev && !ok) {
                ok = true;
                const {TsCheckerRspackPlugin} = require('ts-checker-rspack-plugin');
                config.plugins.push(new TsCheckerRspackPlugin({
                    typescript: {
                        configFile: `tsconfig.json`,
                    },
                }));
            }

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
        salida.generateBuildId = async () => md5(buildDirs.map(d => hashDir(d)).join(''))
    }

    return salida;
}
