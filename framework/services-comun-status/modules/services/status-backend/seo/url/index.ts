/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 3f9ce50e82f0f1306c9c317b9749aad8
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../../config";
import type {EAgrupacion, ISeoUrlCosteOUT, ISeoUrlDetalleOUT} from "./interface";
import {EFuente} from "./interface";

/**
 * Qué detalle se pide.
 *
 * @property project - Proyecto.
 * @property sub     - Subproyecto. **`null` pide los que no tienen** y `undefined` todos los del proyecto, que
 *                     son dos preguntas distintas y las dos legítimas.
 * @property from    - Primer día, `YYYY-MM-DD`.
 * @property to      - Último día, `YYYY-MM-DD`.
 * @property group   - Por página o por URL completa.
 * @property fuente  - Visitas humanas o rastreo de Googlebot. **Sin ella, `VISITAS`** — es la que ya se servía
 *                     antes de que existiera esta propiedad, así que quien no la manda sigue viendo lo mismo
 *                     de siempre. Decide también el endpoint al que se llama: ver `Index.segmento()`.
 * @property filter  - Expresión regular (RE2) para quedarse solo con las URLs que casen.
 * @property negate  - Le da la vuelta a `filter`: quedarse con las que **no** casan. Sin `filter` no significa
 *                     nada, y no es un descuido — «negar la nada» no tiene respuesta, así que se ignora.
 * @property top     - Cuántas filas del listado.
 */
interface IDetalleConfig {
    project: string;
    sub?: string|null;
    from: string;
    to: string;
    group: EAgrupacion;
    fuente?: EFuente;
    filter?: string;
    negate?: boolean;
    top?: number;
}

/**
 * Qué páginas se visitan y cuánto.
 *
 * Solo lectura: el agregado lo escribe el cronjob `status-control` una vez al día en `logs.accesos_uri`, así que
 * no hay nada que guardar desde el panel.
 */
export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    /**
     * El listado de proyectos **no está aquí**: lo sirve `seo/projects`, que lee el catálogo de MySQL.
     *
     * Estuvo aquí, sacado del propio agregado, y costaba 154 MiB de BigQuery en cada carga de la pantalla solo
     * para llenar un desplegable.
     */

    /**
     * La query que comparten el detalle y la descarga, que piden **lo mismo** con dos formatos de salida.
     *
     * `sub` se manda **vacío** para pedir «sin subproyecto» y se omite para pedir «todos»: es la única forma de
     * expresar los tres estados en una URL sin inventarse un centinela que algún día será un subproyecto de
     * verdad. De ahí que el filtro mire `null` y no la longitud, al contrario que los demás.
     *
     * `negate` viaja como `1` y **solo cuando va con un filtro**: en una query un booleano se lee por presencia,
     * y un `negate=0` suelto es un parámetro que hay que acordarse de interpretar en los dos extremos. Colgarlo
     * del filtro además lo hace imposible de desparejar — negar sin nada que negar no llega ni a salir de aquí.
     *
     * `fuente` viaja siempre, con `VISITAS` cuando no se ha pedido otra cosa, y no solo cuando se pide la que no
     * es la de siempre: el endpoint al que se llama ya lo dice (`segmento()`), así que este valor no protege
     * nada — es una comodidad para quien lea la petición en el log de la red, y el backend no lo usa para
     * decidir qué tabla consulta.
     */
    private static query({project, sub, from, to, group, fuente, filter, negate, top}: IDetalleConfig): string {
        const patron = filter !== undefined && filter.length > 0 ? filter : undefined;
        const pares: [string, string|undefined][] = [
            ["project", project],
            ["sub", sub === null ? "" : sub ?? undefined],
            ["from", from],
            ["to", to],
            ["group", group],
            ["fuente", fuente ?? EFuente.VISITAS],
            ["filter", patron],
            ["negate", patron !== undefined && negate === true ? "1" : undefined],
            ["top", top !== undefined ? `${top}` : undefined],
        ];

        return pares
            .filter((par): par is [string, string] => par[1] !== undefined)
            .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
            .join("&");
    }

    /**
     * Qué endpoint atiende una fuente: `/seo/url/*` las visitas humanas y `/seo/googlebot/*` el rastreo.
     *
     * **Y no un parámetro sobre el mismo endpoint**, a propósito: las dos fuentes tienen permisos distintos
     * (`status.seo.url.view` y `status.seo.crawler.view`), y ese permiso se declara en la ruta — ver
     * `StatusRouteGroup` en el backend. Un único endpoint que leyera la fuente de la query obligaría a
     * comprobar el permiso de Googlebot dentro del handler, y de paso dejaría que quien solo tiene uno de los
     * dos permisos pidiera la fuente del otro con solo cambiar un parámetro.
     */
    private static segmento(fuente?: EFuente): string {
        return fuente === EFuente.CRAWLER ? "googlebot" : "url";
    }

    /**
     * La evolución de un proyecto en un rango y qué se visita.
     *
     * Sin `auditRequest`: es una lectura, y la pantalla la repite al cambiar de rango o de agrupación.
     */
    @logRejection(true)
    public static async detalle(token: string, config: IDetalleConfig): Promise<RequestResponse<ISeoUrlDetalleOUT>> {
        return this.get<ISeoUrlDetalleOUT>(`${this.SERVICIO}/backend/seo/${this.segmento(config.fuente)}/detalle?${this.query(config)}`, {auth: token});
    }

    /**
     * Lo que costaría la descarga, **sin ejecutarla**.
     *
     * Es una lectura barata —un `dryRun`, que BigQuery no cobra— y va aparte de la descarga para que la
     * pantalla pueda preguntar antes de gastar.
     */
    @logRejection(true)
    public static async coste(token: string, config: IDetalleConfig): Promise<RequestResponse<ISeoUrlCosteOUT>> {
        return this.get<ISeoUrlCosteOUT>(`${this.SERVICIO}/backend/seo/${this.segmento(config.fuente)}/export/coste?${this.query(config)}`, {auth: token});
    }

    /**
     * La URL de la descarga, **no la descarga**.
     *
     * Es el único método de estos clientes que devuelve una dirección en vez de hacer la petición, y es a
     * propósito: la respuesta es un CSV que puede pesar cien megas, así que quien la pide la reenvía en
     * streaming sin leerla —el puente de Next hace `fetch` y pasa el cuerpo tal cual—. `BackendRequest` no
     * sirve para eso: sus métodos parsean la respuesta entera, y `getForward()`, que sí devuelve un stream, no
     * manda cabeceras y por tanto no vale para un endpoint autenticado.
     *
     * **Sin `top` se lleva el listado completo**, que es la diferencia entre los dos botones de la pantalla.
     */
    public static urlExport(config: IDetalleConfig): string {
        return `${this.SERVICIO}/backend/seo/${this.segmento(config.fuente)}/export?${this.query(config)}`;
    }
}
