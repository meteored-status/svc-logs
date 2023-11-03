module.exports = {
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
        let cfg;
        if (isServer) {
            if (dev) {
                cfg = require("./webpack/service.develop.config")("desarrollo", __dirname, undefined, true);
            } else {
                cfg = require("./webpack/service.production.config")(process.env.ENV??"test", __dirname, undefined, true);
            }
        } else {
            if (dev) {
                const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
                config.plugins.push(new ForkTsCheckerWebpackPlugin());

                cfg = require("./webpack/web.develop.config")("desarrollo", __dirname, undefined, undefined, undefined, true);
            } else {
                cfg = require("./webpack/web.production.config")(process.env.ENV??"test", __dirname, undefined, undefined, undefined, true);
            }
        }
        const plugins = cfg.plugins.filter(actual=>actual.constructor.name==="DefinePlugin");

        config.plugins.push(...plugins);

        config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, res => {
            res.request = res.request.replace(/^node:/, "");
        }));

        return config
    }
};
