const fs = require("node:fs");
const {createHash} = require("node:crypto");

const hashDir = (dir) => {
    const hashes = [];

    if (fs.statSync(dir).isDirectory()) {
        for (const file of fs.readdirSync(dir)) {
            const path = `${dir}/${file}`;
            if (fs.statSync(path).isDirectory()) {
                hashes.push(hashDir(path));
            } else {
                hashes.push(createHash('md5').update(fs.readFileSync(path)).digest('hex'));
            }
        }
    } else {
        hashes.push(createHash('md5').update(fs.readFileSync(dir)).digest('hex'));
    }

    return createHash('md5').update(hashes.join('')).digest("hex");
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
        webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
            // let cfg;
            // if (isServer) {
            //     if (dev) {
            //         cfg = require("./webpack/service.develop.config")("desarrollo", __dirname, undefined, true);
            //     } else {
            //         cfg = require("./webpack/service.production.config")(process.env.ENV??"test", __dirname, undefined, true);
            //     }
            // } else {
            //     if (dev) {
            //         const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
            //         config.plugins.push(new ForkTsCheckerWebpackPlugin());
            //
            //         cfg = require("./webpack/web.develop.config")("desarrollo", __dirname, undefined, undefined, undefined, true);
            //     } else {
            //         cfg = require("./webpack/web.production.config")(process.env.ENV??"test", __dirname, undefined, undefined, undefined, true);
            //     }
            // }
            // const plugins = cfg.plugins.filter(actual=>actual.constructor.name==="DefinePlugin");
            //
            // config.plugins.push(...plugins);

            if (isServer && dev) {
                const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
                config.plugins.push(new ForkTsCheckerWebpackPlugin());
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
        salida.generateBuildId = async () => {
            return createHash('md5').update(buildDirs.map(d => hashDir(d)).join('')).digest("hex");
        }
    }

    return salida;
}
