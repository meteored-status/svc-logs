const fs = require("node:fs");
const path = require('node:path');

module.exports = ({entorno, dir, mode, produccion, pretty, componentes, nextjs})=>{
    const nodeModules = {};
    const paquete = JSON.parse(fs.readFileSync(`${dir}/package.json`).toString());
    paquete.dependencies ??= {};
    for (let mod in paquete.dependencies) {
        nodeModules[mod] = `commonjs ${mod}`;
    }
    if (paquete.dependencies["formidable"]!==undefined && (paquete.dependencies["formidable"].startsWith("^3.") || paquete.dependencies["formidable"].startsWith("3."))) {
        delete nodeModules["formidable"];
    }

    return {
        ...require("./config")({
            entorno,
            dir,
            entry: {
                app: `${dir}/main.ts`,
            },
            output: {
                filename: '[name].js',
                path: path.resolve(dir, 'output'),
            },
            mode,
            produccion,
            plugins: [],
            pretty,
            componentes,
            nextjs,
        }),
        externals: nodeModules,
        target: "node",
    };
}
