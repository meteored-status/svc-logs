// La compilación vive en `@mr/core-cli/esbuild`, compartida con `mrpack`. Aquí solo lo propio:
// el punto de entrada. Los externals salen del `package.json` de este paquete y el tsconfig del
// de al lado, así que no hay nada más que declarar.
import {compilar} from "@mr/core-cli/esbuild";

await compilar({
    url: import.meta.url,
    entry: {"mrlang": "main.ts"},
    watch: process.argv.includes("--watch"),
});
