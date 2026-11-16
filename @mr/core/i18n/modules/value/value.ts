/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 07:46:18 GMT
 * Hash: cf7dc7e604d635d9e3c36c1c07a944f1
 * Versión: 2026.11.9+1-bixus
 * Anterior: 2026.11.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export type TParams = Record<string, string|number>;

export abstract class Value<T extends TParams={}> {
    /* INSTANCE */
    protected readonly params: string[];
    private readonly paramsRegex: RegExp|undefined;
    protected readonly paramsLength;

    protected constructor(params: string[]) {
        this.params = params;
        // Una sola expresión con todos los parámetros, para sustituir en una pasada. Con una por
        // parámetro, el valor que ya se había puesto se volvía a leer en la vuelta siguiente: un
        // nombre escrito por la persona que contuviera `{{otro}}` se sustituía también.
        this.paramsRegex = params.length > 0
            ? new RegExp(`\\{\\{(${params.map(param => param.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\}\\}`, "g")
            : undefined;
        this.paramsLength = params.length;
    }

    protected applyParams(value: string, params?: Partial<T>): string {
        if (this.paramsRegex === undefined) {
            return value;
        }
        const valores: Partial<T> = params ?? {};
        // Con una función y no con una cadena de reemplazo: `String.replace` interpreta `$&`, `$1`
        // o `$$` dentro de la cadena, y el valor puede ser cualquier texto que haya escrito alguien.
        return value.replace(this.paramsRegex, (_coincidencia, nombre: string) => {
            const valor = valores[nombre];
            return valor != undefined ? `${valor}` : nombre.toUpperCase();
        });
    }

    public abstract value(params?: Partial<T>): string;
}
