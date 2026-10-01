import {probador} from "../../lib/probador.js";
import regla from "../../rules/no-returns-on-void.js";

probador.run("no-returns-on-void", regla, {
    valid: [
        `/**
 * Persiste el manifest en disco.
 */
async function save(): Promise<void> {}`,
        // Con retorno de verdad, `@returns` es lo correcto.
        `/**
 * Suma dos números.
 *
 * @returns La suma.
 */
function sumar(a: number, b: number): number { return a + b; }`,
        `/**
 * Carga los datos.
 *
 * @returns Los datos.
 */
async function cargar(): Promise<string[]> { return []; }`,
        // Sin JSDoc no hay nada que quitar.
        "function foo(): void {}",
    ],
    invalid: [
        {
            code: `/**
 * Persiste el manifest en disco.
 *
 * @returns Promesa que se resuelve cuando la escritura ha completado.
 */
async function save(): Promise<void> {}`,
            errors: [{messageId: "returnsInnecesario", data: {retorno: "Promise<void>"}}],
            output: `/**
 * Persiste el manifest en disco.
 */
async function save(): Promise<void> {}`,
        },
        {
            // La etiqueta de retorno en medio: se lleva sus líneas de continuación y nada más.
            code: `/**
 * Hace algo.
 *
 * @returns Nada,
 *          de verdad.
 * @throws Si falla.
 */
function foo(): void {}`,
            errors: [{messageId: "returnsInnecesario", data: {retorno: "void"}}],
            output: `/**
 * Hace algo.
 *
 * @throws Si falla.
 */
function foo(): void {}`,
        },
        {
            // JSDoc que solo tenía la etiqueta: desaparece entero.
            code: `/** @returns Nada. */
function foo(): void {}`,
            errors: [{messageId: "returnsInnecesario"}],
            output: "function foo(): void {}",
        },
        {
            // El JSDoc de un método cuelga del `MethodDefinition`, no de su `value`.
            code: `class A {
    /**
     * Guarda.
     *
     * @returns Nada.
     */
    public async guardar(): Promise<void> {}
}`,
            errors: [{messageId: "returnsInnecesario"}],
            output: `class A {
    /**
     * Guarda.
     */
    public async guardar(): Promise<void> {}
}`,
        },
        {
            // El de una función exportada cuelga del `ExportNamedDeclaration`.
            code: `/**
 * Guarda.
 *
 * @return Nada.
 */
export function guardar(): void {}`,
            errors: [{messageId: "returnsInnecesario"}],
            output: `/**
 * Guarda.
 */
export function guardar(): void {}`,
        },
    ],
});
