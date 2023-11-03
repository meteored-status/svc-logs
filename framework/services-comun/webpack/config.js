const path = require('node:path');
const webpack = require('webpack');
const testeo = require("./testeo");

module.exports = ({entorno, dir, entry, output, mode, produccion, plugins, pretty, componentes={}, nextjs = false})=>{
    componentes.pug = componentes.pug ?? false;
    componentes.css = componentes.css ?? false;
    componentes.css_type = componentes.css_type ?? 0; // 0=inyectado por JS | 1=archivo independiente | 2=critical

    const salida = {
        cache: {
            type: "memory",
        },
        entry,
        output: {
            ...output,
            uniqueName: path.basename(dir),
        },
        mode,
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
        devtool: "source-map",
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
            ]
        },
        plugins: [
            ...plugins,
            new webpack.DefinePlugin({
                DESARROLLO: JSON.stringify(entorno==="desarrollo"),
                TEST: JSON.stringify(entorno==="test"),
                PRODUCCION: JSON.stringify(produccion),
                ENTORNO: JSON.stringify(entorno),
                NEXTJS: JSON.stringify(nextjs),

                "global.DESARROLLO": JSON.stringify(entorno==="desarrollo"),
                "global.TEST": JSON.stringify(entorno==="test"),
                "global.PRODUCCION": JSON.stringify(produccion),
                "global.ENTORNO": JSON.stringify(entorno),
                "global.NEXTJS": JSON.stringify(nextjs),
            }),
        ],
        stats: "minimal",
    };

    if (componentes.css) {
        const MiniCssExtractPlugin = require('mini-css-extract-plugin');

        salida.module.rules.unshift({
            test: /\.s[ac]ss$/i,
            use: [
                {
                    loader: componentes.css_type===0?"style-loader":MiniCssExtractPlugin.loader,
                },
                {
                    loader: "css-loader",
                    options: {
                        sourceMap: testeo(entorno),
                    },
                },
                {
                    loader: "sass-loader",
                    options: {
                        // Prefer `dart-sass`
                        implementation: require.resolve("sass"),
                        sassOptions: {
                            outputStyle: componentes.css_type===2||produccion?"compressed":"expanded",
                        },
                        sourceMap: testeo(entorno),
                    },
                },
            ],
        });
        salida.module.rules.unshift({
            test: /\.css$/,
            use: [
                {
                    loader: componentes.css_type===0?"style-loader":MiniCssExtractPlugin.loader,
                },
                {
                    loader: "css-loader",
                    options: {
                        sourceMap: testeo(entorno),
                    },
                },
            ],
        });
        salida.module.rules.unshift(
            {
                test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
                type: componentes.css_type===2?"asset/inline":"asset/resource",
            },);

        salida.plugins.push(
            new MiniCssExtractPlugin({
                filename: "[name].css",
                // filename: !produccion?"[name].css":"[name]/[contenthash].css",
            }),
        )
    }

    if (componentes.pug) {
        salida.module.rules.unshift({
            test: /\.pug$/,
            use: [
                {
                    loader: "pug3-loader",
                    options: {
                        pretty: pretty,
                    },
                }
            ],
        });
    }

    return salida;
};
