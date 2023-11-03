const path = require("node:path");

module.exports = (entorno, dir, entry, prefix, componentes)=>{
    return require("./web.config")({
        entorno,
        dir,
        entry,
        prefix,
        output: {
            filename: '[name]/[contenthash].js',
            path: path.resolve(dir, "output/bundle"),
        },
        mode: "production",
        produccion: true,
        pretty: false,
        componentes,
    });
};
