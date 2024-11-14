module.exports = (modulo)=>{
    process.chdir(`${__dirname}/..`);
    if (require("node:fs").existsSync(`bin/min/${modulo}.js`)) {
        require(`./min/${modulo}`);
    } else {
        console.log("Compilando herramientas...");
        require("node:child_process").spawn("yarn", ["run", "compile"], {stdio: "inherit"}).on("exit", ()=>{
            require(`./min/${modulo}`);
        });
    }
}
