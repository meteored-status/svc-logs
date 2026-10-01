import {probador} from "../../lib/probador.js";
import regla from "../../rules/class-section-comments.js";

probador.run("class-section-comments", regla, {
    valid: [
        // Un bloque `static {}` es de la sección de estáticos, no de la de instancia.
        `class A {
    /* STATIC */

    public static x: A;

    static {
        this.x = new this();
    }

    /* INSTANCE */

    public y: number;

    public constructor() {
        this.y = 2;
    }
}`,
        // Clase con las dos secciones marcadas.
        `class A {
    /* STATIC */

    public static readonly x = 1;

    /* INSTANCE */

    public y: number;

    public constructor() {
        this.y = 2;
    }
}`,
        // Sin miembros estáticos no hace falta ningún marcador.
        `class A {
    public y: number;

    public constructor() {
        this.y = 2;
    }
}`,
        // Solo miembros estáticos: basta el suyo.
        `class A {
    /* STATIC */

    public static readonly x = 1;
}`,
        // El marcador va por encima del JSDoc del miembro.
        `class A {
    /* STATIC */

    /** Documentación. */
    public static readonly x = 1;

    /* INSTANCE */

    public y: number;
}`,
        // Sin estáticos, un INSTANCE suelto no molesta: la convención dice que «no es necesario»,
        // no que esté prohibido.
        `class A {
    /* INSTANCE */

    public y: number;
}`,
        "class A {}",
    ],
    invalid: [
        {
            // Un comentario al final de la línea anterior es de esa línea: el marcador va debajo de él,
            // encima del JSDoc del miembro. Antes se insertaba en mitad de la línea del estático.
            code: `class A {
    /* STATIC */

    private static readonly UMBRAL = 64 * 1024; // 64 KB

    /** Cola pendiente. */
    private readonly cola: number[];

    public constructor() {
        this.cola = [];
    }
}`,
            output: `class A {
    /* STATIC */

    private static readonly UMBRAL = 64 * 1024; // 64 KB

    /* INSTANCE */

    /** Cola pendiente. */
    private readonly cola: number[];

    public constructor() {
        this.cola = [];
    }
}`,
            errors: [{messageId: "faltaInstance"}],
        },
        {
            code: `class A {
    public static readonly x = 1;

    public y: number;
}`,
            errors: [{messageId: "faltaStatic"}, {messageId: "faltaInstance"}],
            output: `class A {
    /* STATIC */

    public static readonly x = 1;

    /* INSTANCE */

    public y: number;
}`,
        },
        {
            code: `class A {
    /* STATIC */

    public static readonly x = 1;

    public y: number;
}`,
            errors: [{messageId: "faltaInstance"}],
            output: `class A {
    /* STATIC */

    public static readonly x = 1;

    /* INSTANCE */

    public y: number;
}`,
        },
        {
            // El marcador se inserta antes del JSDoc, no entre el JSDoc y su miembro.
            code: `class A {
    /** Documentación. */
    public static readonly x = 1;
}`,
            errors: [{messageId: "faltaStatic"}],
            output: `class A {
    /* STATIC */

    /** Documentación. */
    public static readonly x = 1;
}`,
        },
        {
            code: `class A {
    /* STATIC */

    public y: number;
}`,
            errors: [{messageId: "staticSobrante"}],
            output: `class A {
    public y: number;
}`,
        },
    ],
});
