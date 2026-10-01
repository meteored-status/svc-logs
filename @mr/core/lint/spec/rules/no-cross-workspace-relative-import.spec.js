import {fileURLToPath} from "node:url";
import path from "node:path";

import {probador} from "../../lib/probador.js";
import regla from "../../rules/no-cross-workspace-relative-import.js";

/**
 * Los ficheros de los casos se sitúan dentro de este propio paquete, que tiene `package.json` y por
 * tanto es un workspace de verdad: la regla resuelve la raíz mirando el disco, así que un fichero
 * inventado en una ruta que no existe no serviría para distinguir «dentro» de «fuera».
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FICHERO = path.join(RAIZ, "rules", "ejemplo.ts");

probador.run("no-cross-workspace-relative-import", regla, {
    valid: [
        {code: "import {a} from \"./otro\";", filename: FICHERO},
        {code: "import {a} from \"../lib/utilidades.js\";", filename: FICHERO},
        {code: "import {a} from \"eslint\";", filename: FICHERO},
        // Fuera de un fichero real la regla no tiene raíz con la que comparar y se calla.
        "import {a} from \"../../otro-servicio/lib/a\";",
    ],
    invalid: [
        {
            code: "import {a} from \"../../services/frontend/lib/format/currency\";",
            filename: FICHERO,
            errors: [{messageId: "usaNombreDePaquete"}],
        },
    ],
});
