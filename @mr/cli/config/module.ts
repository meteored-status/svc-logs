import {CssExtractRspackPlugin, ModuleOptions} from "@rspack/core";

import {type ManifestBuildComponentes, ManifestBuildComponentesCSS} from "../manifest/workspace/build/bundle/componentes";

interface IModuleConfig {
    componentes: ManifestBuildComponentes;
    desarrollo: boolean;
    test: boolean;
    rules?: string;
}

export class Module {
    /* STATIC */
    public static build({componentes, desarrollo, test, rules}: IModuleConfig): ModuleOptions {
        const salida: ModuleOptions = {
            rules: [],
        }

        if (componentes.pug) {
            salida.rules!.push({
                test: /\.pug$/,
                use: [
                    {
                        loader: require.resolve("pug3-loader"),
                        options: {
                            pretty: desarrollo,
                        },
                    }
                ],
            });
        }
        if (componentes.css!=ManifestBuildComponentesCSS.DESACTIVADO) {
            salida.rules!.push({
                test: /\.(png|jpe?g|gif|svg|eot|ttf|woff)$/i,
                type: componentes.css==ManifestBuildComponentesCSS.CRITICAL?"asset/inline":"asset/resource",
            });
            salida.rules!.push({
                test: /\.css$/,
                use: [
                    {
                        loader: componentes.css==ManifestBuildComponentesCSS.INYECTADO?
                            require.resolve("style-loader"):
                            CssExtractRspackPlugin.loader,
                    },
                    {
                        loader: require.resolve("css-loader"),
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
                        loader: componentes.css==ManifestBuildComponentesCSS.INYECTADO?
                            require.resolve("style-loader"):
                            CssExtractRspackPlugin.loader,
                    },
                    {
                        loader: require.resolve("css-loader"),
                        options: {
                            sourceMap: test,
                        },
                    },
                    {
                        loader: require.resolve("sass-loader"),
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
                type: 'javascript/auto',
            });
        }

        // salida.rules!.push({
        //     enforce: 'pre',
        //     test: /\.([cm]?[tj]s|tsx)$/,
        //     use: [
        //         {
        //             loader: require.resolve("source-map-loader"),
        //         },
        //     ],
        // });
        salida.rules!.push({
            test: /\.([cm]?ts|tsx)$/,
            exclude: [/node_modules/],
            loader: 'builtin:swc-loader',
            options: {
                jsc: {
                    parser: {
                        syntax: 'typescript',
                        decorators: true,
                        // dynamicImport: true,
                    },
                    transform: {
                        // legacyDecorator: true,
                        decoratorMetadata: true,
                    },
                },
            },
            type: 'javascript/auto',
        });
        // salida.rules!.push({
        //     test: /\.([cm]?ts|tsx)$/,
        //     use: [
        //         {
        //             loader: require.resolve("ts-loader"),
        //         },
        //     ],
        // });

        if (rules!=undefined) {
            salida.rules!.push(...require(rules));
        }

        return salida;
    }

    /* INSTANCE */
}
