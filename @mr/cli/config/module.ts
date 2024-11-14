import MiniCssExtractPlugin from "mini-css-extract-plugin";
import webpack from "webpack";

import {IConfigServiceComponentes} from "../src/mrpack/clases/workspace/service";

type TModule = webpack.Configuration['module'];

interface IModuleConfig extends IConfigServiceComponentes {
    desarrollo: boolean;
    test: boolean;
    rules?: string;
}

export class Module {
    /* STATIC */
    public static build({css, css_type, desarrollo, pug, test, rules}: IModuleConfig): TModule {
        const salida: TModule = {
            rules: [],
        }

        if (pug) {
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
        if (css) {
            salida.rules!.push({
                test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
                type: css_type==2?"asset/inline":"asset/resource",
            });
            salida.rules!.push({
                test: /\.css$/,
                use: [
                    {
                        loader: css_type==0?"style-loader":MiniCssExtractPlugin.loader,
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
                        loader: css_type===0?"style-loader":MiniCssExtractPlugin.loader,
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
                                outputStyle: css_type===2||!desarrollo?"compressed":"expanded",
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
