import {probador} from "../../lib/probador.js";
import regla from "../../rules/config-object-params.js";

probador.run("config-object-params", regla, {
    valid: [
        // Un único opcional, y al final: se queda posicional, tenga la forma que tenga.
        "function condonarResto(prestamoId: string, fecha: string, notas?: string): void {}",
        "class A { private async hayOtra(nombre: string, idExcluido?: string): Promise<boolean> { return false; } }",
        "function render(params: Record<string, string> = {}): string { return \"\"; }",
        "function buscar(id: number, transaction?: Transaction): Promise<void> {}",
        {
            code: "interface I { alCambiar(valor: string, extra?: number): void; }",
            options: [{incluirTipos: true}],
        },

        // El idiom que la convención pide, con sus tres variantes admitidas.
        "function foo(path: string, {verbose = false, retries = 3}: IFooConfig = {}): void {}",
        "function foo(path: string, config?: IFooConfig): void {}",
        "function foo(path: string, opciones: IFooConfig = {}): void {}",
        "function foo(frase: string, {confiar = false}: {confiar?: boolean} = {}): void {}",
        // Nombre de dominio, pero tipo `…Config`: es un objeto de configuración igual.
        "function crear(datos: NuevoPrestamo, movimiento?: IMovimientoDePrestamoConfig): void {}",
        // Sin parámetros opcionales no hay nada que agrupar.
        "function foo(a: string, b: number): void {}",
        "function Componente({titulo, onCerrar}: IProps) {}",
        // Los tipos de función solo se miran si se pide.
        "interface I { alCambiar(valor: string, extra?: number): void; }",
        // `permitirUltimo`: el idiom de la transacción opcional, que la convención admite.
        {
            code: "function buscar(id: number, transaction?: Transaction): Promise<void> {}",
            options: [{permitirUltimo: ["transaction"]}],
        },
        {
            code: "class A { constructor(config: IBulkConfig, transaction?: Transaction) {} }",
            options: [{permitirUltimo: ["transaction"]}],
        },
    ],
    invalid: [
        {
            // Con dos opcionales, la transacción final no es la que sobra si está en `permitirUltimo`:
            // solo se denuncia el otro.
            code: "function buscar(id: number, limite?: number, transaction?: Transaction): Promise<void> {}",
            options: [{permitirUltimo: ["transaction"]}],
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "limite"}}],
        },
        {
            // Dos opcionales: ya no es «el último», es una lista, y se denuncian los dos.
            code: "function condonarResto(prestamoId: string, fecha?: string, notas?: string): void {}",
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "fecha"}}, {messageId: "agrupaEnConfig", data: {parametro: "notas"}}],
        },
        {
            // Con dos, la transacción final sin `permitirUltimo` cuenta como uno más.
            code: "function buscar(id: number, limite?: number, transaction?: Transaction): Promise<void> {}",
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "limite"}}, {messageId: "agrupaEnConfig", data: {parametro: "transaction"}}],
        },
        {
            // Con dos, `permitirUltimo` exige el nombre entero.
            code: "function buscar(id?: number, transactionId?: string): Promise<void> {}",
            options: [{permitirUltimo: ["transaction"]}],
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "id"}}, {messageId: "agrupaEnConfig", data: {parametro: "transactionId"}}],
        },
        {
            code: "interface I { alCambiar(valor?: string, extra?: number): void; }",
            options: [{incluirTipos: true}],
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "valor"}}, {messageId: "agrupaEnConfig", data: {parametro: "extra"}}],
        },
        {
            code: "function foo(path: string, verbose = false, retries = 3): void {}",
            errors: [{messageId: "agrupaEnConfig"}, {messageId: "agrupaEnConfig"}],
        },
        {
            // Opcional que ni siquiera es el último.
            code: "function foo(a?: string, b: number): void {}",
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "a"}}],
        },
        {
            // La excepción es solo para el último parámetro.
            code: "function buscar(transaction?: Transaction, id?: number): Promise<void> {}",
            options: [{permitirUltimo: ["transaction"]}],
            errors: [{messageId: "agrupaEnConfig", data: {parametro: "transaction"}}, {messageId: "agrupaEnConfig", data: {parametro: "id"}}],
        },
    ],
});
