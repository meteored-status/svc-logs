import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";

import {type ManifestBuildComponentes, ManifestBuildComponentesCSS} from "../manifest/workspace/build/bundle/componentes";

type TModule = webpack.Configuration['module'];

interface IModuleConfig {
    componentes: ManifestBuildComponentes;
    desarrollo: boolean;
    test: boolean;
    rules?: string;
}

export class Module {
    /* STATIC */
    public static build({componentes, desarrollo, test, rules}: IModuleConfig): TModule {
        const salida: TModule = {
            rules: [],
        }

        if (componentes.pug) {
            salida.rules!.push({
                test: /\.pug$/,
                use: [
                    {
                        loader: "pug3-loader",
                        options: {
                            pretty: desarrollo,
                        },
                    }
                ],
            });
        }
        if (componentes.css!=ManifestBuildComponentesCSS.DESACTIVADO) {
            salida.rules!.push({
                test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
                type: componentes.css==ManifestBuildComponentesCSS.CRITICAL?"asset/inline":"asset/resource",
            });
            salida.rules!.push({
                test: /\.css$/,
                use: [
                    {
                        loader: componentes.css==ManifestBuildComponentesCSS.INYECTADO?"style-loader":MiniCssExtractPlugin.loader,
                    },
                    {
                        loader: "css-loader",
                        options: {
                            sourceMap: test,
                        },
                    },
                ],
            });
            salida.rules!.push({
                test: /\.s[ac]ss$/i,
                use: [
                    {
                        loader: componentes.css==ManifestBuildComponentesCSS.INYECTADO?"style-loader":MiniCssExtractPlugin.loader,
                    },
                    {
                        loader: "css-loader",
                        options: {
                            sourceMap: test,
                        },
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            // Prefer `dart-sass`
                            implementation: require.resolve("sass"),
                            sassOptions: {
                                outputStyle: componentes.css==ManifestBuildComponentesCSS.CRITICAL||!desarrollo?"compressed":"expanded",
                            },
                            sourceMap: test,
                        },
                    },
                ],
            });
        }

        salida.rules!.push({
            enforce: 'pre',
            test: /\.([cm]?[tj]s|tsx)$/,
            use: [
                {
                    loader: require.resolve("source-map-loader"),
                },
            ],
        });
        salida.rules!.push({
            test: /\.([cm]?ts|tsx)$/,
            use: [
                {
                    loader: require.resolve("ts-loader"),
                },
            ],
        });

        if (rules!=undefined) {
            salida.rules!.push(...require(rules));
        }

        return salida;
    }

    /* INSTANCE */
}
