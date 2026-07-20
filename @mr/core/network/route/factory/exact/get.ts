/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 11 Jun 2026 10:10:08 GMT
 * Hash: 5a62b3f174500b6f7d343abb9d4f37d0
 * Versión: 2026.6.11+2-josantoniojimnez
 */

import {Route} from "../..";

import type {ICrearExactOptions} from ".";

/**
 * Crea una {@link Route} para una URL exacta con método GET.
 * Es la forma más concisa de registrar una ruta simple sin parámetros de URL.
 *
 * @param nombre  - Identificador único de la ruta.
 * @param url     - URL exacta que activa la ruta (e.g. `"/"`).
 * @param options - Configuración de dominio, idiomas y métodos.
 * @returns Nueva instancia de `Route` lista para usar en el router.
 *
 * @example
 * const rutaHome = crearExactGET("home", "/", {dominio, idiomas: ["es", "en"]});
 */
export default (nombre: string, url: string, {dominio, dominios, idiomas, metodos}: ICrearExactOptions): Route => {
    if (dominios === undefined) {
        dominios = [
            dominio.host(dominio.BASE),
            dominio.host(dominio.WWW),
        ];
    }

    return new Route({
        dominio,
        idiomas,
    }, {
        nombre,
        expresiones: [
            {
                dominios,
                metodos: metodos ?? ["GET"],
                lang: {
                    include: idiomas,
                },
                exact: url,
                resumen: url,
            },
        ],
        idiomas,
        url: {
            defecto: url,
        },
    });
};
