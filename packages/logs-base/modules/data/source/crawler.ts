import crawlerUserAgents from "crawler-user-agents";

export class Crawler {
    /* STATIC */
    private static readonly crawlers: Crawler[] = crawlerUserAgents.map(actual=> new this(actual.pattern));
    private static readonly cache: Map<string, Crawler|null> = new Map<string, Crawler|null>();

    public static test(ua: string): Crawler|null {
        let cache = this.cache.get(ua);
        if (cache!==undefined) {
            return cache;
        }

        for (const crawler of this.crawlers) {
            if (crawler.check(ua)) {
                this.cache.set(ua, crawler);
                return crawler;
            }
        }

        this.cache.set(ua, null);
        return null;
    }

    /* INSTANCE */
    private readonly pattern: RegExp;
    public readonly name: string;

    private constructor(pattern: string) {
        this.pattern = new RegExp(pattern);
        this.name = this.pattern.source
            .replace("\\d\\.\\d+", "")
            .replace(" \\", "")
            .replace("\\/", "")
            .replace("\\.", ".")
            .replace("\\.", ".")
            .replace("^", "")
            .replace("[bB]", "b")
            .replace("[Cc]", "c")
            .replace("[eE]", "e")
            .replace("[mM]", "m")
            .replace("[pP]", "p")
            .replace("[rR]", "r")
            .replace("[wW]", "w")
            .replace(/\(.*\)/, "")
            .toLowerCase();

    }

    private check(userAgent: string): boolean {
        return this.pattern.test(userAgent);
    }
}
