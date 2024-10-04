const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const path = require("node:path");
const webpack = require('webpack');

module.exports = {
    entry: {
        "mrlang": `${__dirname}/mrlang/main.ts`,
        "mrpack": `${__dirname}/mrpack/main.ts`,
    },
    cache: {
        type: "memory",
    },
    output: {
        filename: '[name]-run.js',
        path: path.resolve(__dirname, "../bin"),
        chunkFilename: 'plugins/[name].js',
    },
    watch: true,
    mode: "production",
    optimization: {
        concatenateModules: true,
        runtimeChunk: 'single',
        splitChunks: {
            chunks: 'all',
        },
    },
    resolve: {
        extensions: ['.ts', '.js', '.tsx', '.jsx'],
        extensionAlias: {
            ".js": [".js", ".ts"],
            ".cjs": [".cjs", ".cts"],
            ".mjs": [".mjs", ".mts"]
        }
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                test: /\.([cm]?[tj]s|tsx)$/,
                use: [
                    {
                        loader: require.resolve("source-map-loader"),
                    },
                ],
            },
            {
                test: /\.([cm]?ts|tsx)$/,
                use: [
                    {
                        loader: require.resolve("ts-loader"),
                    },
                ],
            },
        ],
    },
    plugins: [
        // new CleanWebpackPlugin(),
        // new webpack.BannerPlugin({
        //     banner: "#!/usr/bin/env node\nrequire(\"source-map-support\").install();",
        //     raw: true,
        // }),
        new webpack.DefinePlugin({
            DESARROLLO: JSON.stringify(false),
            TEST: JSON.stringify(false),
            PRODUCCION: JSON.stringify(true),
            ENTORNO: JSON.stringify("produccion"),
            NEXTJS: JSON.stringify(false),
            DATABASE: JSON.stringify("undefined"),
            COMMIT_FECHA: JSON.stringify("undefined"),

            "global.DESARROLLO": JSON.stringify(false),
            "global.TEST": JSON.stringify(false),
            "global.PRODUCCION": JSON.stringify(true),
            "global.ENTORNO": JSON.stringify("produccion"),
            "global.NEXTJS": JSON.stringify(false),
            "global.DATABASE": JSON.stringify("undefined"),
            "global.COMMIT_FECHA": JSON.stringify("undefined"),
        }),
    ],
    externals: [
        function({request}, callback) {
            if (request.includes("mysql2") || request.includes("tslib")) {
                return callback(null, `commonjs ${request}`);
            }
            callback();
        },
    ],
    target: "node",
    stats: "minimal",
    devtool: "source-map"
};
