import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Crawler} from "../modules/data/crawler";

describe("Crawler", () => {

    it("no detecta nada sin user-agent", () => {
        assert.equal(Crawler.test(), undefined);
        assert.equal(Crawler.test(""), undefined);
    });

    it("detecta un bot conocido", () => {
        const crawler = Crawler.test("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");

        assert.notEqual(crawler, undefined);
        assert.equal(crawler?.name, "googlebot");
    });

    it("no marca como bot un navegador normal", () => {
        const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

        assert.equal(Crawler.test(ua), undefined);
    });

    it("devuelve siempre la misma instancia para el mismo user-agent (caché)", () => {
        const ua = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";

        assert.equal(Crawler.test(ua), Crawler.test(ua));
    });

    it("humaniza el patrón: no quedan restos de sintaxis de expresión regular en el nombre", () => {
        const nombres = [
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
            "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
            "facebookexternalhit/1.1",
        ].map(ua=>Crawler.test(ua)?.name);

        for (const nombre of nombres) {
            assert.notEqual(nombre, undefined);
            assert.equal(nombre, nombre?.toLowerCase());
            assert.doesNotMatch(nombre as string, /\\|\[|\]|\^/, `nombre con restos de regexp: ${nombre}`);
        }
    });
});
