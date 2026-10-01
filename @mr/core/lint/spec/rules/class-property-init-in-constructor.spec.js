import {probador} from "../../lib/probador.js";
import regla from "../../rules/class-property-init-in-constructor.js";

probador.run("class-property-init-in-constructor", regla, {
    valid: [
        `class A {
    private readonly items: string[];
    private activo: boolean;

    public constructor() {
        this.items = [];
        this.activo = false;
    }
}`,
        // Las estáticas quedan fuera: no hay constructor donde inicializarlas.
        "class A { private static readonly maximo = 10; }",
        // Sin valor no hay nada que mover, con `!` o con `declare`.
        "class A { public readonly tabla!: string[]; }",
        "class A { declare public readonly tabla: string[]; }",
        {
            code: "class A { private readonly manejar = () => {}; }",
            options: [{permitirFunciones: true}],
        },
    ],
    invalid: [
        {
            code: "class A { private readonly items: string[] = []; }",
            errors: [{messageId: "inicializaEnConstructor", data: {propiedad: "items"}}],
        },
        {
            code: "class A { private activo = false; }",
            errors: [{messageId: "inicializaEnConstructor"}],
        },
        {
            code: "class A { private readonly manejar = () => {}; }",
            errors: [{messageId: "inicializaEnConstructor"}],
        },
        {
            code: "class A { accessor total = 0; }",
            errors: [{messageId: "inicializaEnConstructor"}],
        },
    ],
});
