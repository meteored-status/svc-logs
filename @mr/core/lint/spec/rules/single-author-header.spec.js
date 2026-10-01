import {probador} from "../../lib/probador.js";
import regla from "../../rules/single-author-header.js";

const CABECERA = `/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: abbbf413afce84faefe54597ab4db42d
 * Versión: 2026.9.23+2-bixus
 * Anterior: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */`;

const ANTIGUA = `/**
 * Editor: miguel
 * Fecha: Tue, 14 Jul 2026 11:18:49 GMT
 * Hash: b7d6381f98f349b691d8e9f69775d785
 * Versión: 2026.7.14+1-miguel
 */`;

probador.run("single-author-header", regla, {
    valid: [
        `${CABECERA}\n\nimport {a} from "./a";\n\nexport const b = a;\n`,
        "import {a} from \"./a\";\n\nexport const b = a;\n",
        // Un JSDoc que menciona al editor no es una cabecera: le falta la línea `Fecha:`.
        `${CABECERA}\n\n/**\n * Editor: el que abre el fichero.\n */\nexport const b = 1;\n`,
    ],
    invalid: [
        {
            // Dos seguidas al principio: la buena es la primera, que es la que puso el último envío.
            code: `${CABECERA}\n\n${ANTIGUA}\n\nexport const b = 1;\n`,
            output: `${CABECERA}\n\nexport const b = 1;\n`,
            errors: [{messageId: "cabeceraDuplicada"}],
        },
        {
            // Una que ya no está al principio no la quita nadie.
            code: `${CABECERA}\n\nimport {a} from "./a";\n\n${ANTIGUA}\n\nexport const b = a;\n`,
            output: `${CABECERA}\n\nimport {a} from "./a";\n\nexport const b = a;\n`,
            errors: [{messageId: "cabeceraDuplicada"}],
        },
        {
            // Sin cabecera al principio sobran todas: el siguiente envío pondrá la suya.
            code: `"use client";\n\n${ANTIGUA}\n\nexport const b = 1;\n`,
            output: `"use client";\n\nexport const b = 1;\n`,
            errors: [{messageId: "cabeceraDuplicada"}],
        },
        {
            // La de un fichero comentado entero con el IDE, que es el caso que hay en `mr-components`.
            code: `${CABECERA}\n\n${ANTIGUA.split("\n").map((l) => `// ${l}`).join("\n")}\n//\n// import {a} from "./a";\n`,
            output: `${CABECERA}\n\n// import {a} from "./a";\n`,
            errors: [{messageId: "cabeceraDuplicada"}],
        },
    ],
});
