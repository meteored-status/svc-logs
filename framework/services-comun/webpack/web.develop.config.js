const path = require("node:path");

module.exports = (entorno, dir, entry, prefix, componentes, nextjs)=>{
    return {
        ...require("./web.config")({
            entorno,
            dir,
            entry,
            prefix,
            output: {
                filename: '[name].js',
                path: path.resolve(dir, "output/bundle"),
            },
            mode: "development",
            produccion: false,
            pretty: true,
            componentes,
            nextjs,
        }),

        watch: true,
        watchOptions: {
            aggregateTimeout: 1000,
            // ignored: /(\.yarn\/|files\/|output\/)/,
            ignored: [
                ".yarn/*",
                ".yarn/**/*",
                "assets/*",
                "assets/**/*",
                "files/*",
                "files/**/*",
                "output/*",
                "output/**/*",

                "**/.yarn/*",
                "**/.yarn/**/*",
                "**/assets/*",
                "**/assets/**/*",
                "**/files/*",
                "**/files/**/*",
                "**/output/*",
                "**/output/**/*",
            ],
        },
    };
};
