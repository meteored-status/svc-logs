module.exports = (entorno, dir, componentes, nextjs)=>{
    return {
        ...require("./service.config")({
            entorno,
            dir,
            mode: "development",
            produccion: false,
            pretty: true,
            componentes,
            nextjs
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
