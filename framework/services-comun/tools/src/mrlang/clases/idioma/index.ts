export type TIdiomas = Record<string, string[]|undefined>;

export class Idiomas {
    /* INSTANCE */
    private defecto: string[];
    private codes: string[];
    private fallbacks: TIdiomas;
    private fallbacksDown: Record<string, string[]>;

    public constructor(fallbacks: TIdiomas) {
        this.defecto = [];
        this.codes = [];
        this.fallbacks = {};
        this.fallbacksDown = {};

        this.init(fallbacks);
    }

    protected init(fallbacks: TIdiomas): void {
        this.defecto = fallbacks[""] ?? [];
        this.fallbacksDown = {};
        delete fallbacks[""];
        this.fallbacks = fallbacks;

        const codes = Object.keys(fallbacks);
        for (const key of Object.keys(fallbacks)) {
            const values = fallbacks[key]!;
            codes.push(...values);
            for (const value of values) {
                this.fallbacksDown[value] ??= [key];
            }
        }
        this.codes = [...new Set(codes)].sort();

        function padres(fallbacks: Record<string, string[]>, lang: string): string[] {
            const salida: string[] = [];
            const antecesores = fallbacks[lang];
            if (antecesores == undefined) {
                return [];
            }
            for (const antecesor of antecesores) {
                if (!salida.includes(antecesor)) {
                    salida.push(antecesor);
                    salida.push(...padres(fallbacks, antecesor));
                }
            }

            return [...new Set(salida)];
        }

        for (const key of Object.keys(this.fallbacksDown)) {
            this.fallbacksDown[key] = padres(this.fallbacksDown, key);
        }
    }

    public toJSON(): TIdiomas {
        return {
            ...this.fallbacks,
            "": this.defecto,
        };
    }

    public getFallbacksUP(idioma: string): string[] {
        return this.fallbacks[idioma] ?? this.defecto;
    }

    public getFallbacksDOWN(idioma: string): string[] {
        return this.fallbacksDown[idioma] ?? this.defecto;
    }

    public getKeys(): string[] {
        return Object.keys(this.fallbacks);
    }
}
