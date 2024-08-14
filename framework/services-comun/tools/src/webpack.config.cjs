const path = require("node:path");
const webpack = require('webpack');

module.exports = {
    cache: {
        type: "memory",
    },
    entry: {
        "mrpack": `${__dirname}/main.ts`,
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, "../bin"),
    },
    watch: true,
    mode: "production",
    optimization: {
        concatenateModules: true,
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
        new webpack.BannerPlugin({
            banner: "#!/usr/bin/env node",
            raw: true,
        }),
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
    target: "node",
    stats: "minimal",
};
