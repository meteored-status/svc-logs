/**
 * Clase abstracta que representa a un individuo de un algoritmo genético.
 *
 * Un individuo tiene un conjunto de genes. Cada gen puede tomar un valor de 0 o 1.
 * Cada gen representa una característica del individuo (por ejemplo, un determinado color, si es o no relevante, etc...).
 *
 * El individuo tiene una función fitness que determina su aptitud
 * la cual sirve para determinar si es mejor que otro individuo y pasa a la
 * siguiente generación o no.
 */
export abstract class Individual {

    private readonly _genes: number[];

    /**
     * Constructor.
     * @param numGenes Número de genes que tendrá el individuo.
     * @param genes Valor predeterminado de los genes. En caso de no especificarse, se generan aleatoriamente.
     * @protected
     */
    protected constructor(numGenes: number, genes?: number[]) {
        if (genes) {
            this._genes = genes;
        } else {
            // Generamos genes aleatorios
            this._genes = [];
            for (let i = 0; i < numGenes; i++) {
                this._genes.push(Math.round(Math.random()));
            }
        }
    }

    public get genes(): number[] {
        return this._genes;
    }

    /**
     * Determina la aptitud del individuo.
     */
    public abstract fitness(): number;

    /**
     * Clona el individuo.
     */
    public abstract clone(): Individual
}
