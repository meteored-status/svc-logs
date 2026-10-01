/**
 * Editor: Bixus
 * Fecha: Thu, 17 Sep 2026 14:19:23 GMT
 * Hash: 5d2cbf969d1c8375a900ac19f68a32fe
 * Versión: 2026.9.17+2-bixus
 * Anterior: 2026.9.16+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {flattenLang, getLang, langChain} from "../modules/util/lang";

/**
 * `getLang` decide con qué idioma se carga un módulo. Es la pieza donde un descuido no da error de
 * compilación y sí un texto en el idioma equivocado —o un módulo que no existe—.
 */
describe("getLang", () => {

    it("normaliza el separador: es-ES, es_ES y esES son el mismo idioma", () => {
        assert.equal(getLang(["esES"], "es-ES"), "esES");
        assert.equal(getLang(["esES"], "es_ES"), "esES");
        assert.equal(getLang(["esES"], "esES"), "esES");
    });

    it("si el idioma pedido no está, usa el que se pase por defecto", () => {
        assert.equal(getLang(["esES", "frFR"], "de-DE", "es-ES"), "esES");
    });

    it("prefiere el idioma pedido antes que el de por defecto", () => {
        assert.equal(getLang(["esES", "frFR"], "fr-FR", "es-ES"), "frFR");
    });

    it("sin idioma por defecto cae en 'enUS', exista o no en el módulo", () => {
        // Este es el motivo de que el idioma por defecto sea obligatorio al cargar una traducción: cuando
        // no llega, esto devuelve un 'enUS' fijo que la mayoría de los módulos de este panel no declaran
        // —son es/en/fr, con 'enGB'—, y lo que revienta después es la carga, ya lejos de aquí.
        assert.equal(getLang(["esES", "frFR"], "de-DE"), "enUS");
        assert.equal(getLang([], "de-DE"), "enUS");
    });

    it("un idioma por defecto que tampoco está tampoco salva: sigue cayendo en 'enUS'", () => {
        assert.equal(getLang(["esES"], "de-DE", "pt-PT"), "enUS");
    });

    it("aplana todos los separadores, no solo el primero", () => {
        // El fallo que motivó que esto fuera una función y no una línea suelta en cada extremo: la del
        // generador era `replace("-", "")`, que sustituye solo la primera ocurrencia. Con dos subtags
        // coincidía por casualidad con la del runtime y con tres dejaba de coincidir.
        assert.equal(getLang(["caESvalencia"], "ca-ES-valencia"), "caESvalencia");
        assert.equal(getLang(["zhHantTW"], "zh-Hant-TW"), "zhHantTW");
    });

    it("un idioma sin variante sirve a sus variantes: ca vale para ca-ES-valencia", () => {
        // Lo que antes hacía falta un acierto exacto: un módulo traducido al catalán dejaba al valenciano en
        // el defecto del módulo —o en inglés—, aunque el texto correcto estuviese ahí al lado.
        assert.equal(getLang(["ca", "en"], "ca-ES-valencia"), "ca");
        assert.equal(getLang(["zh", "en"], "zh-Hant-TW"), "zh");
    });

    it("la variante gana al idioma suelto cuando el módulo tiene las dos", () => {
        assert.equal(getLang(["ca", "caESvalencia"], "ca-ES-valencia"), "caESvalencia");
        assert.equal(getLang(["ca", "caES"], "ca-ES-valencia"), "caES");
    });

    it("agota la cadena del idioma pedido antes de mirar el de por defecto", () => {
        // El orden importa y es el de RFC 4647: un catalán aproximado es mejor respuesta a una petición en
        // valenciano que el francés por defecto del módulo.
        assert.equal(getLang(["ca", "frFR"], "ca-ES-valencia", "fr-FR"), "ca");
    });

    it("el idioma por defecto también se busca por su cadena", () => {
        assert.equal(getLang(["es", "en"], "de-DE", "es-MX"), "es");
    });

    it("ignora las mayúsculas, que en BCP 47 no distinguen idiomas", () => {
        // `ca-es-VALENCIA` es el mismo idioma que `ca-ES-valencia`, y de un Accept-Language llega lo que
        // llega. Lo que se devuelve es la entrada del módulo, que es un nombre de directorio y tiene que
        // salir con su caja.
        assert.equal(getLang(["caESvalencia"], "ca-es-VALENCIA"), "caESvalencia");
        assert.equal(getLang(["esES"], "ES-es"), "esES");
    });
});

/**
 * `flattenLang` es el nombre con el que un idioma se escribe en disco. Lo usan los dos extremos —`mrlang`
 * al crear el directorio y `getLang()` al buscarlo—, así que lo que se prueba aquí es la convención misma.
 */
describe("flattenLang", () => {

    it("quita los separadores, sean cuantos sean", () => {
        assert.equal(flattenLang("es-ES"), "esES");
        assert.equal(flattenLang("es_ES"), "esES");
        assert.equal(flattenLang("ca-ES-valencia"), "caESvalencia");
        assert.equal(flattenLang("zh-Hant-TW"), "zhHantTW");
    });

    it("deja intacto lo que no los tiene", () => {
        assert.equal(flattenLang("fil"), "fil");
        assert.equal(flattenLang("esES"), "esES");
    });

    it("da identificadores JS válidos, que es como se emiten en el bundle", () => {
        // `definition.ts` escribe `import caESvalencia from "..."` con esto, así que un código que
        // aplanado no fuera un identificador rompería el fichero generado, no esta función.
        for (const lang of ["es-ES", "es-419", "sr-Cyrl", "ca-ES-valencia", "fil"]) {
            assert.match(flattenLang(lang), /^[A-Za-z_$][A-Za-z\d_$]*$/, lang);
        }
    });
});

/**
 * `langChain` es el *Lookup* de RFC 4647: de qué se echa mano, y en qué orden, cuando el idioma pedido no
 * está tal cual. Es lógica pura y equivocarse no rompe ninguna compilación — se ve en pantalla o no se ve.
 */
describe("langChain", () => {

    it("va de más específico a menos, quitando un subtag cada vez", () => {
        assert.deepEqual(langChain("ca-ES-valencia"), ["ca-ES-valencia", "ca-ES", "ca"]);
        assert.deepEqual(langChain("zh-Hant-TW"), ["zh-Hant-TW", "zh-Hant", "zh"]);
        assert.deepEqual(langChain("es-ES"), ["es-ES", "es"]);
    });

    it("un idioma sin variantes es su propia cadena", () => {
        assert.deepEqual(langChain("fil"), ["fil"]);
    });

    it("acepta el guion bajo, igual que el resto del módulo", () => {
        assert.deepEqual(langChain("es_MX"), ["es-MX", "es"]);
    });

    it("el subtag de una letra nunca se queda al final", () => {
        // `u` abre una extensión y por sí solo no nombra ningún idioma, así que `de-DE-u` no puede ser un
        // paso de la cadena: al truncar `co` se va con él. `de-DE-u-co` sí lo es, porque lo que queda al
        // final es `co`.
        const cadena = langChain("de-DE-u-co-phonebk");
        assert.deepEqual(cadena, ["de-DE-u-co-phonebk", "de-DE-u-co", "de-DE", "de"]);
        assert.equal(cadena.includes("de-DE-u"), false);
    });

    it("una entrada vacía no da cadena", () => {
        assert.deepEqual(langChain(""), []);
    });
});
