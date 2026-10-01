import {probador} from "../../lib/probador.js";
import regla from "../../rules/single-line-signature.js";

probador.run("single-line-signature", regla, {
    valid: [
        // Una flecha sin paréntesis pasada como argumento: el `(` y el `)` que la rodean son los de la
        // llamada, no los de su lista de parámetros.
        `docs.map(doc => {
    return doc.id;
});`,
        `promesa.then(resultado => {
    usar(resultado);
}, error => {
    fallar(error);
});`,
        "function foo(path: string, {verbose = false}: IFooConfig = {}): void {}",
        "const f = (a: number, b: number): number => a + b;",
        // Flecha de un solo parámetro sin paréntesis: no hay lista que comprobar.
        "const f = x => x + 1;",
        "function sinParametros(): void {}",
        // El cuerpo sí puede ocupar varias líneas.
        `function foo(a: number): number {
    return a
        + 1;
}`,
        "interface I { metodo(a: string, b: number): void; }",
        `class A {
    public metodo(a: string, b: number): void {}
}`,
    ],
    invalid: [
        {
            code: `function foo(
    path: string,
    verbose: boolean,
): void {}`,
            errors: [{messageId: "unaSolaLinea"}],
        },
        {
            // También con un solo parámetro: el salto de línea es lo que sobra.
            code: `function foo(
    path: string
): void {}`,
            errors: [{messageId: "unaSolaLinea"}],
        },
        {
            code: `const f = (
    a: number,
    b: number,
): number => a + b;`,
            errors: [{messageId: "unaSolaLinea"}],
        },
        {
            code: `class A {
    public metodo(
        a: string,
    ): void {}
}`,
            errors: [{messageId: "unaSolaLinea"}],
        },
        {
            code: `interface I {
    metodo(
        a: string,
    ): void;
}`,
            errors: [{messageId: "unaSolaLinea"}],
        },
    ],
});
