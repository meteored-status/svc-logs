import crawlerUserAgents from "crawler-user-agents";

export class Crawler {
    /* STATIC */
    private static readonly crawlers: Crawler[] = crawlerUserAgents.map(actual=> new this(actual.pattern));
    private static readonly cache: Record<string, Crawler|null|undefined> = {};

    public static test(ua?: string): Crawler|undefined {
        if (!ua) {
            return;
        }

        const cache = this.cache[ua];
        if (cache!==undefined) {
            return cache??undefined;
        }

        for (const crawler of this.crawlers) {
            if (crawler.check(ua)) {
                this.cache[ua] = crawler;

                return crawler;
            }
        }

        this.cache[ua] = null;

        return;
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
