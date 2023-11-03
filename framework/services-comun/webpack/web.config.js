// const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const {WebpackManifestPlugin} = require('webpack-manifest-plugin');
const testeo = require("./testeo");

module.exports = ({entorno, dir, entry={}, prefix="", output, mode, produccion, pretty, componentes, nextjs})=>{
    const salida = {
        ...require("./config")({
            entorno,
            dir,
            entry,
            output,
            mode,
            produccion,
            plugins: [
                // new CleanWebpackPlugin({
                //     verbose: true,
                //     cleanOnceBeforeBuildPatterns: [
                //         '**/*',
                //         '!manifest.json',
                //     ],
                // }),
                new WebpackManifestPlugin({
                    fileName: 'stats.json',
                    filter: (obj)=>!obj.path.includes('.js.map'),
                    generate: (seed, files, entrypoints)=>{
                        const entrypoints_final = {};
                        for (let actual in entrypoints) {
                            // noinspection JSUnfilteredForInLoop
                            entrypoints_final[actual+".js"] = entrypoints[actual]
                                .filter((elemento)=>!elemento.includes(".js.map"))
                                .map((elemento)=>`/${prefix}js/bundle/${elemento}`);
                        }
                        return entrypoints_final;
                    },
                }),

            ],
            pretty,
            componentes,
            nextjs,
        }),
        externals: {},
        optimization: {
            runtimeChunk: 'single',
            splitChunks: {
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendor',
                        chunks: 'all',
                    },
                },
                chunks: 'all',
            },
        },
        target: ['web', 'es5'],
    };

    if (!testeo(entorno)) {
        delete salida.devtool;
    }

    return salida;
};
