import {probador} from "../../lib/probador.js";
import regla from "../../rules/import-blocks.js";

const CON_WORKSPACES = [{workspaces: ["@mr/core"]}];

probador.run("import-blocks", regla, {
    valid: [
        // Un comentario al final de un import es de ese import, no separa del siguiente.
        "import {a} from \"x\"; // nota\nimport {b} from \"y\";",
        // Los alias de ruta del tsconfig (`@/`, `~/`) son el propio workspace.
        "import {useState} from \"react\";\n\nimport {Boton} from \"@/components/boton\";\nimport {util} from \"~/lib/util\";\nimport {a} from \"./a\";",
        // Código entre dos imports: las líneas en blanco que lo rodean no son separación entre bloques.
        "import sourceMapSupport from \"source-map-support\";\nsourceMapSupport.install();\n\nimport {MRPack} from \"./mrpack\";",
        // Con código por medio no se avisa ni, sobre todo, se autocorrige: el arreglo reemplaza el hueco
        // entero y borraría lo que hubiera. Pasó de verdad en homeconomy con un `"use client";` mal
        // colocado, y el fallo no salió hasta el prerenderizado del build. Allí la regla avisaba sin
        // arreglar; aquí ya no avisa, porque esas líneas en blanco no separan dos imports.
        `import {useEffect} from "react";
"use client";

import {Result} from "./result";`,
        `import {useEffect} from "react";
import crypto from "node:crypto";

import {Result} from "./result";`,
        // Los tres bloques.
        {
            code: `import {useEffect} from "react";

import {Mensaje} from "@mr/core";

import {Result} from "./result";`,
            options: CON_WORKSPACES,
        },
        // `import type` cuenta como destructurado.
        `import {useEffect, useState} from "react";
import type {ReactNode} from "react";
import Link from "next/link";

import {formatCurrency} from "../lib/format/currency";`,
        // Un import de efecto lateral no participa en la ordenación por forma.
        `import {ThemeProvider} from "./theme-provider";
import "./globals.scss";`,
        // Alfabético desactivado por defecto.
        `import {zeta} from "./zeta";
import {alfa} from "./alfa";`,
        {
            code: `import {alfa} from "./alfa";
import {zeta} from "./zeta";`,
            options: [{alfabetico: true}],
        },
        "import {solo} from \"react\";",
    ],
    invalid: [
        {
            code: `import {useEffect} from "react";
import {Result} from "./result";`,
            errors: [{messageId: "faltaSeparacion"}],
            output: `import {useEffect} from "react";

import {Result} from "./result";`,
        },
        {
            code: `import {useEffect} from "react";

import {useState} from "react";`,
            errors: [{messageId: "sobraSeparacion"}],
            output: `import {useEffect} from "react";
import {useState} from "react";`,
        },
        {
            code: `import {useEffect} from "react";



import {Result} from "./result";`,
            errors: [{messageId: "separacionDeMas"}],
            output: `import {useEffect} from "react";

import {Result} from "./result";`,
        },
        {
            code: `import {Result} from "./result";

import {useEffect} from "react";`,
            errors: [{messageId: "bloqueDesordenado"}],
        },
        {
            code: `import Link from "next/link";
import {useEffect} from "react";`,
            errors: [{messageId: "defectoAntesDeDestructurado"}],
        },
        {
            code: `import {zeta} from "./zeta";
import {alfa} from "./alfa";`,
            options: [{alfabetico: true}],
            errors: [{messageId: "desordenAlfabetico", data: {actual: "alfa", anterior: "zeta"}}],
        },
        {
            // Con un comentario por medio se avisa igual, pero no se autocorrige.
            code: `import {useEffect} from "react";
// Un comentario.
import {Result} from "./result";`,
            errors: [{messageId: "faltaSeparacion"}],
        },
    ],
});
