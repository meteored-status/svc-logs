import crawlerUserAgents from "crawler-user-agents";

export class Crawler {
    /* STATIC */
    /**
     * Tamaño máximo del caché de user-agents ya resueltos. El proceso es de vida larga y el
     * abanico de user-agents es ilimitado, así que sin cota el caché crecería sin control.
     */
    private static readonly CACHE_MAX = 10000;

    private static readonly crawlers: Crawler[] = crawlerUserAgents.map(actual=>new this(actual.pattern));
    private static readonly cache: Map<string, Crawler|null> = new Map();

    /**
     * Convierte el patrón de `crawler-user-agents` en un nombre legible, quitando los restos de
     * sintaxis de expresión regular (escapes, anclas, clases de un solo carácter, versiones).
     */
    private static humanizar(pattern: string): string {
        return pattern
            .replaceAll("\\d\\.\\d+", "")
            .replaceAll(" \\", "")
            .replaceAll("\\/", "")
            .replaceAll("\\.", ".")
            .replaceAll("^", "")
            .replace(/\[([a-zA-Z])[a-zA-Z]\]/g, "$1")
            .replace(/\(.*\)/, "")
            .toLowerCase();
    }

    public static test(ua?: string): Crawler|undefined {
        if (!ua) {
            return undefined;
        }

        const cache = this.cache.get(ua);
        if (cache!==undefined) {
            return cache??undefined;
        }

        const crawler = this.crawlers.find(actual=>actual.check(ua)) ?? null;
        this.guardarCache(ua, crawler);

        return crawler??undefined;
    }

    private static guardarCache(ua: string, crawler: Crawler|null): void {
        if (this.cache.size>=this.CACHE_MAX) {
            // FIFO simple: soltamos la entrada más antigua para mantener el caché acotado
            const primera = this.cache.keys().next();
            if (!primera.done) {
                this.cache.delete(primera.value);
            }
        }

        this.cache.set(ua, crawler);
    }

    /* INSTANCE */
    public readonly name: string;

    private readonly pattern: RegExp;

    private constructor(pattern: string) {
        this.pattern = new RegExp(pattern);
        this.name = Crawler.humanizar(this.pattern.source);
    }

    private check(userAgent: string): boolean {
        return this.pattern.test(userAgent);
    }
}
