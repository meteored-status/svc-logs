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
            DESARROLLO: "false",
            TEST: "false",
            PRODUCCION: "true",
            ENTORNO: "produccion",
        }),
    ],
    target: "node",
    stats: "minimal",
};
