import {TsCheckerRspackPlugin} from "ts-checker-rspack-plugin";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import rspack from "@rspack/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

const {dependencies} = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));
const ES_MODULES = {
    "@inquirer/prompts": "8",
    "chokidar": "5",
    "formidable": "3",
    "mime": "4",
    "pdf-merger-js": "5",
    "uuid": "13",
    // "mysql": "3",
};

const externals = [];

function check(actual , version ) {
    return actual.startsWith(`^${version}.`)
        || actual.startsWith(`~${version}.`)
        || actual.startsWith(`${version}.`);
}

for (let mod in dependencies) {
    if (!ES_MODULES[mod] || !check(dependencies[mod], ES_MODULES[mod])) {
        externals.push({[mod]: `commonjs ${mod}`});
        // salida[mod] = `commonjs ${mod}`;
    } else {
        externals.push({[mod]: `module ${mod}`});
        // salida[mod] = `module ${mod}`;
    }
}
// for (let mod in dependencies) {
//     if (mod==="@inquirer/prompts") {
//         externals.push({[mod]: `"${mod}"`});
//     } else {
//         externals.push({[mod]: `commonjs ${mod}`});
//     }
// }
externals.push(({request}, callback)=>{
    if (request!=null) {
        for (let mod in dependencies) {
            if (request.startsWith(mod)) {
                return callback(null, `commonjs ${request}`);
            }
        }
    }
    callback();
});

export default {
    entry: {
        "mrlang": `${__dirname}/mrlang/main.ts`,
        "mrpack": `${__dirname}/mrpack/main.ts`,
    },
    cache: true,
    output: {
        filename: "[name]-run.js",
        path: resolve(__dirname, "../bin/min"),
        chunkFilename: "plugins/[name].js",
        clean: true,
    },
    mode: "production",
    optimization: {
        concatenateModules: true,
        runtimeChunk: false,
        splitChunks: {
            chunks: "all",
        },
    },
    resolve: {
        extensions: [".ts", ".js", ".tsx", ".jsx"],
        extensionAlias: {
            ".js": [".js", ".ts"],
            ".cjs": [".cjs", ".cts"],
            ".mjs": [".mjs", ".mts"]
        }
    },
    module: {
        rules: [
            {
                test: /\.([cm]?ts|tsx)$/,
                exclude: [/node_modules/],
                loader: "builtin:swc-loader",
                options: {
                    jsc: {
                        parser: {
                            syntax: "typescript",
                        },
                    },
                },
                type: "javascript/auto",
            },
            // {
            //     test: /\.([cm]?ts|tsx)$/,
            //     use: [
            //         {
            //             loader: "builtin:swc-loader",
            //         },
            //     ],
            // },
        ],
    },
    plugins: [
        new rspack.DefinePlugin({
            DESARROLLO: JSON.stringify(false),
            TEST: JSON.stringify(false),
            PRODUCCION: JSON.stringify(true),
            ENTORNO: JSON.stringify("produccion"),
            NEXTJS: JSON.stringify(false),
            DATABASE: JSON.stringify("undefined"),

            "global.DESARROLLO": JSON.stringify(false),
            "global.TEST": JSON.stringify(false),
            "global.PRODUCCION": JSON.stringify(true),
            "global.ENTORNO": JSON.stringify("produccion"),
            "global.NEXTJS": JSON.stringify(false),
            "global.DATABASE": JSON.stringify("undefined"),
        }),
        new TsCheckerRspackPlugin({
            mode: "write-references",
            typescript: {
                configFile: "src/tsconfig.json",
            },
        }),
    ],
    externals,
    target: "node",
    stats: "minimal",
    devtool: "source-map"
};
