/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 11 Jun 2026 10:10:08 GMT
 * Hash: 44565cef9d1c8cd65d01a78c6f4e4f23
 * Versión: 2026.6.11+2-josantoniojimnez
 */

import type {Idioma} from "@mr/core-i18n/langs";

import type {Dominio} from "../../../server/http/config/dominio";
import type {TMetodo} from "../../../server/http/conexion";

/**
 * Opciones para {@link crearExactGET}.
 *
 * @property dominio  - Instancia de dominio del servicio.
 * @property dominios - Hosts que aceptan esta ruta. Si se omite, se usan `dominio.BASE` y `dominio.WWW`.
 * @property idiomas  - Idiomas soportados por la ruta.
 * @property metodos  - Métodos HTTP permitidos. Por defecto `["GET"]`.
 */
export interface ICrearExactOptions {
    dominio: Dominio;
    dominios?: string[];
    idiomas: Idioma[];
    metodos?: TMetodo[];
}
