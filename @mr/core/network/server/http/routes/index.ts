/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: fb5f7118b8e5066e20db3138e32605f1
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import type {Checker} from "../checkers";
import type {Conexion, TMetodo} from "../conexion";
import type {RouteGroup, RouteGroupError} from "./group";

/**
 * Tabla de enrutamiento del servicio HTTP.
 *
 * Mantiene una lista ordenada de {@link RouteGroup} y los evalúa en orden en cada petición.
 * También centraliza la obtención de rutas documentables para la generación de documentación.
 */
export class Routes {

    /** Lista de grupos de rutas evaluados en orden en cada petición. */
    private readonly groups: RouteGroup[];

    /** Handler de error invocado cuando ningún grupo procesa la petición. */
    public readonly error: RouteGroupError;

    public constructor(groups: RouteGroup[], error: RouteGroupError) {
        this.groups = groups;
        this.error = error;
    }

    /**
     * Devuelve todas las rutas marcadas como documentables, ordenadas alfabéticamente
     * por su `resumen`. Se usa para generar la documentación del servicio.
     */
    public getDocumentables(): Checker[] {
        const salida: Checker[] = [];

        for (const grupo of this.groups) {
            if (!grupo.params.documentable) {
                continue;
            }
            salida.push(...grupo.getDocumentables());
        }

        return salida.sort((a, b) => a.resumen.localeCompare(b.resumen));
    }

    /**
     * Evalúa los grupos de rutas en orden y delega la petición al primero que haga match.
     * @param conexion - Conexión HTTP entrante.
     * @returns `true` si algún grupo procesó la petición, `false` si ninguno lo hizo.
     */
    public async check(conexion: Conexion): Promise<boolean> {
        for (const grupo of this.groups) {
            if (await grupo.check(conexion)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Recopila los métodos HTTP aceptados por cualquier ruta del servicio para la
     * URL/dominio/idioma/query de la conexión, ignorando el método entrante.
     * Lo usa {@link route} para decidir entre devolver `405 Method Not Allowed`
     * (con la cabecera `Allow:` poblada) o caer al handler de `404`.
     */
    public collectAllowedMethods(conexion: Conexion): Set<TMetodo> {
        const allowed = new Set<TMetodo>();
        for (const grupo of this.groups) {
            grupo.collectAllowedMethods(conexion, allowed);
        }
        return allowed;
    }
}
