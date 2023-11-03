module.exports = (entorno, dir, componentes, nextjs)=>{
    return require("./service.config")({
        entorno,
        dir,
        mode: "production",
        produccion: true,
        pretty: false,
        componentes,
        nextjs,
    });
};
