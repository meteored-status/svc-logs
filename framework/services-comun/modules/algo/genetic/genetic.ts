import {Individual} from "./individual";

/**
 * Clase que implementa el algoritmo genético.
 * @param T Tipo de individuo.
 *
 * Dado un conjunto de individuos, se generan nuevos individuos a partir de ellos.
 * Esto se hace mutando los genes de los individuos.
 * Se valora cada individuo y se seleccionan los mejores utilizando la función fitness.
 */
export class Genetic<T extends Individual> {
    /* STATIC */

    /* INSTANCE */
    /**
     * Constructor.
     * @param input Conjunto de individuos.
     * @param blocks Número de bloques en los que se dividirá el conjunto de individuos (mín: 1 bloque, máx: el número de idividuos).
     * @param fitness Función que determina la aptitud de un grupo de individuos.
     */
    public constructor(
        private readonly input: T[],
        private readonly blocks: number,
        private readonly fitness: (input: T[]) => number) {
    }

    /**
     * Ejecuta el algoritmo genético.
     * @param iterations Número de generaciones.
     */
    public async run(iterations: number): Promise<T[]> {

        const itemsPart: number = Math.floor(this.input.length / this.blocks);

        const subset: T[][] = [];

        for (let i = 0; i < this.blocks; i++) {
            subset.push(this.input.slice(i * itemsPart, (i + 1) * itemsPart));
        }
        subset[this.blocks - 1].push(...this.input.slice(this.blocks * itemsPart));

        for (let i = 0; i < iterations; i++) {

            await Promise.all(subset.map(async (s, index) => {
                subset[index] = await this.processBlock(s);
            }));
        }

        return subset.reduce((a, b) => a.concat(b), []);
    }

    private async processBlock(data: T[]): Promise<T[]> {
        const current: T[] = [];

        for (const d of data) {
            const clone = d.clone() as T;
            this.mutate(clone);
            current.push(clone);
        }

        if (this.fitness(current) > this.fitness(data)) return current;
        return data;
    }

    private mutate(individual: T): T {
        const mutate: boolean = Math.random() < 0.5;
        if (mutate) {
            const index: number = Math.floor(Math.random() * individual.genes.length);
            individual.genes[index] = individual.genes[index] === 0 ? 1 : 0;
        }
        return individual;
    }
}

