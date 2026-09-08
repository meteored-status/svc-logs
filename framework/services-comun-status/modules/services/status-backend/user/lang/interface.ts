/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 14:04:25 GMT
 * Hash: f101a57e000e7ac3f11dda3dbf4998c7
 * Versión: 2026.9.3+2-bixus
 * Anterior: 2026.9.2+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Los idiomas en los que existe el panel.
 *
 * **Aquí y no derivado de los módulos de traducción**, aunque cada uno declare su propia lista: la de un módulo
 * generado dice en qué idiomas está *ese* texto, y esta dice en qué idiomas se ofrece *el panel*. Son dos cosas, y
 * la segunda es una decisión de producto que hay que poder leer en un sitio.
 *
 * Si alguna vez divergen —un `.json` sin `es`— no se rompe nada: `getLang()` cae al defecto para ese módulo y el
 * resto de la pantalla sigue en su idioma. Se degrada por texto, no por pantalla.
 *
 * **El orden de esta lista no se ve en ninguna parte.** Lo fue: era el orden del desplegable, con el idioma
 * del equipo primero. Hoy el selector se ordena solo, alfabéticamente y por el nombre que se lee —no por
 * el código—, así que aquí un idioma nuevo se puede añadir donde caiga.
 *
 * **Añadir un idioma es esta línea y sus textos, y nada más.** De aquí salen el enrutado (`i18nConfig`), los botones
 * del selector y la validación del endpoint, así que no hay ningún otro sitio que actualizar — lo único que queda es
 * rellenar el idioma en los `.json` de `i18n/` y regenerar.
 *
 * **`ca` es también el valenciano, y no por descuido.** El valenciano no tiene código propio: ni ISO 639-1 ni
 * 639-3 lo separan del catalán, y la única forma normalizada de nombrarlo es la variante BCP 47 `ca-ES-valencia`.
 * Aquí no cabe por dos motivos concretos, no por criterio: la columna `user.lang` es `VARCHAR(10)` y esa etiqueta
 * mide catorce, y el catálogo de `mrlang` no la conoce —ni sabría a qué idioma caer—. Los textos están escritos
 * eligiendo, cuando las dos normas discrepan, las formas que valen en ambas.
 */
export const IDIOMAS = ["es", "en", "fr", "ca"] as const;

/** Uno de los idiomas del panel. */
export type TIdioma = typeof IDIOMAS[number];

/**
 * El idioma al que se cae cuando no se sabe cuál toca.
 *
 * `en` y no `es`, al contrario que el defecto de la **columna** `user.lang`: son dos defectos distintos a
 * propósito. El de la columna es «qué idioma se le supone a alguien que entra por primera vez», y ahí el equipo es
 * español; este es «qué se pinta cuando el idioma pedido no existe», y ahí lo que interesa es el idioma que más
 * gente entiende.
 */
export const IDIOMA_DEFECTO: TIdioma = "en";

/**
 * Si una cadena cualquiera es uno de los idiomas del panel.
 *
 * Hace de guarda de tipo, que es lo que permite validar en el borde —el handler— y trabajar con `TIdioma` dentro
 * sin volver a comprobarlo.
 *
 * @param valor Lo que haya llegado.
 */
export const idiomaValido = (valor: string): valor is TIdioma => (IDIOMAS as readonly string[]).includes(valor);

/**
 * Cambio del idioma **del propio usuario**.
 *
 * @property lang - El idioma elegido. Se valida en el handler contra `IDIOMAS`: la columna admite cualquier cadena
 *                  de diez caracteres, así que si no se acota aquí acabaría guardando lo que mande el navegador.
 */
export interface ILangIN {
    lang: string;
}
