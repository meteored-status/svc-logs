import {Checker, type IExpresion} from ".";

/**
 * Checker comodín que acepta cualquier URL cuando está habilitado,
 * o rechaza todas cuando está deshabilitado.
 * Útil como ruta de fallback al final de una cadena de checkers.
 */
export class Comodin extends Checker {
    /** Si `true`, cualquier URL produce coincidencia; si `false`, ninguna la produce. */
    protected readonly defecto: boolean;

    /**
     * @param obj     - Criterios y opciones de la expresión.
     * @param defecto - Si `true`, el checker actúa como comodín (acepta todo).
     */
    public constructor(obj: IExpresion, defecto: boolean) {
        super(obj);

        this.defecto = defecto;
    }

    protected checkEjecutar(url: string): string[] | null {
        return this.defecto ? [url] : null;
    }
}
