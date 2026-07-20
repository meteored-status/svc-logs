/**
 * Editor: Chema
 * Fecha: Fri, 03 Jul 2026 07:08:50 GMT
 * Hash: 54fd762bc863d2f24c66a3adc2158d4b
 * Versión: 2026.7.3+2-chema
 * Anterior: 2026.7.1+1-chema
 * Proyecto: https://github.com/alpred-cms/svc-redaccion.git
 */

import {exists, readJSON} from "./fs";
import {error} from "./log";

/**
 * Credenciales de cuenta de servicio de Google Cloud usadas para autenticar
 * contra la Google Analytics Data API (GA4).
 *
 * @property type                        - Tipo de credencial (normalmente `service_account`).
 * @property project_id                  - Identificador del proyecto de Google Cloud.
 * @property private_key_id              - Identificador de la clave privada.
 * @property private_key                 - Clave privada en formato PEM.
 * @property client_email               - Email de la cuenta de servicio.
 * @property client_id                  - Identificador del cliente.
 * @property auth_uri                    - Endpoint de autorización OAuth2.
 * @property token_uri                   - Endpoint de obtención de tokens OAuth2.
 * @property auth_provider_x509_cert_url - URL del certificado del proveedor de autenticación.
 * @property client_x509_cert_url       - URL del certificado de la cuenta de servicio.
 */
interface ICredencialesGA4 {
    type?: string;
    project_id?: string;
    private_key_id?: string;
    private_key?: string;
    client_email?: string;
    client_id?: string;
    auth_uri?: string;
    token_uri?: string;
    auth_provider_x509_cert_url?: string;
    client_x509_cert_url?: string;
    [key: string]: unknown;
}

/**
 * Rango de fechas de un informe de GA4. Acepta tanto fechas absolutas
 * (`YYYY-MM-DD`) como relativas (`today`, `yesterday`, `NdaysAgo`).
 *
 * @property startDate - Fecha de inicio (inclusive).
 * @property endDate   - Fecha de fin (inclusive).
 * @property name      - Nombre opcional del rango, útil al comparar periodos.
 */
interface IDateRange {
    startDate: string;
    endDate: string;
    name?: string;
}

/**
 * Dimensión solicitada en un informe (p.ej. `pagePath`, `hostname`).
 *
 * @property name - Nombre de la dimensión de GA4.
 */
interface IDimension {
    name: string;
}

/**
 * Métrica solicitada en un informe (p.ej. `activeUsers`, `screenPageViews`).
 *
 * @property name - Nombre de la métrica de GA4.
 */
interface IMetric {
    name: string;
}

/**
 * Petición de informe (`runReport`) de la Google Analytics Data API.
 * Se modela de forma parcial: solo se tipan los campos de uso más habitual,
 * permitiendo el resto mediante la firma de índice para no limitar la API.
 *
 * @property dateRanges      - Rangos de fechas a consultar.
 * @property dimensions      - Dimensiones a desglosar.
 * @property metrics         - Métricas a agregar.
 * @property dimensionFilter - Filtro aplicado sobre las dimensiones.
 * @property metricFilter    - Filtro aplicado sobre las métricas.
 * @property orderBys        - Criterios de ordenación de las filas.
 * @property limit           - Número máximo de filas a devolver.
 * @property offset          - Desplazamiento de la primera fila devuelta.
 * @property keepEmptyRows   - Si `true`, conserva las filas sin datos.
 */
interface IRunReportRequest {
    dateRanges?: IDateRange[];
    dimensions?: IDimension[];
    metrics?: IMetric[];
    dimensionFilter?: unknown;
    metricFilter?: unknown;
    orderBys?: unknown[];
    limit?: number;
    offset?: number;
    keepEmptyRows?: boolean;
    [key: string]: unknown;
}

/**
 * Valor individual de una dimensión o métrica dentro de una fila de resultados.
 *
 * @property value - Valor textual tal y como lo devuelve GA4.
 */
interface IReportValue {
    value: string;
}

/**
 * Fila de resultados de un informe de GA4.
 *
 * @property dimensionValues - Valores de las dimensiones solicitadas, en orden.
 * @property metricValues    - Valores de las métricas solicitadas, en orden.
 */
interface IReportRow {
    dimensionValues: IReportValue[];
    metricValues: IReportValue[];
}

/**
 * Respuesta de un informe (`runReport`) de la Google Analytics Data API.
 *
 * @property rows              - Filas de resultados; ausente si no hay datos.
 * @property dimensionHeaders  - Cabeceras de las dimensiones devueltas.
 * @property metricHeaders     - Cabeceras de las métricas devueltas.
 * @property rowCount          - Número total de filas disponibles.
 */
interface IRunReportResponse {
    rows?: IReportRow[];
    dimensionHeaders?: {name: string}[];
    metricHeaders?: {name: string; type?: string}[];
    rowCount?: number;
    [key: string]: unknown;
}

/**
 * Par clave/valor extraído de la primera dimensión y primera métrica de cada fila.
 *
 * @property key   - Valor de la primera dimensión de la fila.
 * @property value - Valor de la primera métrica de la fila.
 */
interface IReportKeyValue {
    key: string;
    value: string;
}

/**
 * Resultado de comparar una misma clave entre dos periodos.
 *
 * @property key       - Valor de la primera dimensión de la fila.
 * @property actual    - Valor de la métrica en el periodo actual.
 * @property anterior  - Valor de la métrica en el periodo anterior.
 * @property delta     - Diferencia numérica `actual - anterior`.
 * @property variacion - Variación porcentual respecto al periodo anterior;
 *                       `null` cuando el periodo anterior es 0 (no calculable).
 */
interface IReportComparacion {
    key: string;
    actual: string;
    anterior: string;
    delta: number;
    variacion: number | null;
}

interface IBetaAnalyticsDataClient {
    runReport(request: IRunReportRequest & {property: string}): Promise<[IRunReportResponse, ...unknown[]]>;
    runReports(request: {property: string; requests: IRunReportRequest[]}): Promise<[{reports?: IRunReportResponse[]}, ...unknown[]]>;
}

interface IBetaAnalyticsDataClientConstructor {
    new (options: {credentials: ICredencialesGA4}): IBetaAnalyticsDataClient;
}

/**
 * Propiedad de GA4 devuelta por la Admin API.
 *
 * @property timeZone - Zona horaria IANA (p.ej. `Europe/Madrid`) usada por la
 *                       propiedad para generar sus informes; dimensiones como
 *                       `date`, `dateHour` o los rangos `dateRanges` se calculan
 *                       respecto a esta zona horaria, no en UTC.
 */
interface IAnalyticsAdminProperty {
    timeZone?: string;
    [key: string]: unknown;
}

interface IAnalyticsAdminServiceClient {
    getProperty(request: {name: string}): Promise<[IAnalyticsAdminProperty, ...unknown[]]>;
}

interface IAnalyticsAdminServiceClientConstructor {
    new (options: {credentials: ICredencialesGA4}): IAnalyticsAdminServiceClient;
}

const {BetaAnalyticsDataClient} = require("@google-analytics/data") as {BetaAnalyticsDataClient: IBetaAnalyticsDataClientConstructor};
const {AnalyticsAdminServiceClient} = require("@google-analytics/admin") as {AnalyticsAdminServiceClient: IAnalyticsAdminServiceClientConstructor};

const CREDENCIALES_PATH = "files/credenciales/analytics.json";
const TIME_ZONE_DEFECTO = "Etc/UTC";

class GAnalytics4V2 {
    /* STATIC */

    private static credenciales: Promise<ICredencialesGA4> | null = null;
    private static cliente: Promise<IBetaAnalyticsDataClient> | null = null;
    private static clienteAdmin: Promise<IAnalyticsAdminServiceClient> | null = null;
    private static timeZones: Map<number, Promise<string>> = new Map();

    private static async loadCredenciales(): Promise<ICredencialesGA4> {
        if (this.credenciales === null) {
            this.credenciales = (async (): Promise<ICredencialesGA4> => {
                if (!await exists(CREDENCIALES_PATH)) {
                    return Promise.reject("Firebase disabled");
                }
                return readJSON<ICredencialesGA4>(CREDENCIALES_PATH);
            })().catch((err) => {
                this.credenciales = null;
                return Promise.reject(err);
            });
        }
        return this.credenciales;
    }

    private static async getClient(): Promise<IBetaAnalyticsDataClient> {
        if (this.cliente === null) {
            this.cliente = this.loadCredenciales()
                .then((credentials) => new BetaAnalyticsDataClient({credentials}))
                .catch((err) => {
                    this.cliente = null;
                    return Promise.reject(err);
                });
        }
        return this.cliente;
    }

    private static async getAdminClient(): Promise<IAnalyticsAdminServiceClient> {
        if (this.clienteAdmin === null) {
            this.clienteAdmin = this.loadCredenciales()
                .then((credentials) => new AnalyticsAdminServiceClient({credentials}))
                .catch((err) => {
                    this.clienteAdmin = null;
                    return Promise.reject(err);
                });
        }
        return this.clienteAdmin;
    }

    private static mapKeyValue(response: IRunReportResponse): IReportKeyValue[] {
        return (response.rows ?? [])
            .filter((row) => row.dimensionValues?.length > 0 && row.metricValues?.length > 0)
            .map((row) => ({
                key: row.dimensionValues[0].value,
                value: row.metricValues[0].value,
            }));
    }

    /**
     * Ejecuta un informe contra la propiedad indicada y devuelve la respuesta
     * cruda de GA4, dando acceso a todas las dimensiones y métricas solicitadas.
     */
    public static async runReport(propiedad: number, config: IRunReportRequest): Promise<IRunReportResponse> {
        const client = await this.getClient();
        try {
            const [response] = await client.runReport({
                property: `properties/${propiedad}`,
                ...config,
            });
            return response;
        } catch (err) {
            error("GAnalytics4.runReport", propiedad, err);
            return Promise.reject(err);
        }
    }

    /**
     * Devuelve la zona horaria (IANA) de generación de informes configurada en
     * la propiedad de GA4. Dimensiones como `date`/`dateHour` y los `dateRanges`
     * se calculan respecto a esta zona horaria, no en UTC, por lo que cualquier
     * filtro que se construya manualmente sobre ellas debe tenerla en cuenta.
     * El resultado se cachea por propiedad para evitar llamadas repetidas a la
     * Admin API.
     */
    public static async getPropertyTimeZone(propiedad: number): Promise<string> {
        if (!this.timeZones.has(propiedad)) {
            const promesa = this.getAdminClient()
                .then((client) => client.getProperty({name: `properties/${propiedad}`}))
                .then(([property]) => property.timeZone ?? TIME_ZONE_DEFECTO)
                .catch((err) => {
                    this.timeZones.delete(propiedad);
                    error("GAnalytics4.getPropertyTimeZone", propiedad, err);
                    return Promise.reject(err);
                });
            this.timeZones.set(propiedad, promesa);
        }
        return this.timeZones.get(propiedad)!;
    }

    /**
     * Ejecuta varios informes en una única petición (`batchRunReports`) y devuelve
     * la respuesta cruda de cada uno, preservando el orden de entrada.
     */
    public static async runBatchReports(propiedad: number, requests: IRunReportRequest[]): Promise<IRunReportResponse[]> {
        if (requests.length === 0) {
            return [];
        }
        const client = await this.getClient();
        try {
            const [response] = await client.runReports({
                property: `properties/${propiedad}`,
                requests,
            });
            return response.reports ?? [];
        } catch (err) {
            error("GAnalytics4.runBatchReports", propiedad, err);
            return Promise.reject(err);
        }
    }

    /**
     * Ejecuta un informe y proyecta cada fila a un par `{key, value}` tomando la
     * primera dimensión y la primera métrica.
     */
    public static async getAnalyticsReport(propiedad: number, config: IRunReportRequest): Promise<IReportKeyValue[]> {
        const response = await this.runReport(propiedad, config);
        return this.mapKeyValue(response);
    }

    /**
     * Ejecuta un informe paginando de forma transparente hasta recuperar todas
     * las filas disponibles, sorteando el límite máximo de filas por petición de
     * GA4. Devuelve los pares `{key, value}` agregados de todas las páginas.
     */
    public static async getAnalyticsReportPaginado(propiedad: number, config: IRunReportRequest, pageSize: number = 10000): Promise<IReportKeyValue[]> {
        const tamano = Math.max(1, pageSize);
        const datos: IReportKeyValue[] = [];
        let offset = 0;
        let total = Infinity;
        while (offset < total) {
            const response = await this.runReport(propiedad, {
                ...config,
                limit: tamano,
                offset,
            });
            total = response.rowCount ?? offset + (response.rows?.length ?? 0);
            const pagina = this.mapKeyValue(response);
            datos.push(...pagina);
            if (pagina.length < tamano) {
                break;
            }
            offset += tamano;
        }
        return datos;
    }

    /**
     * Ejecuta el mismo informe sobre dos periodos y devuelve, por cada clave, los
     * valores de ambos periodos junto con la diferencia absoluta y la variación
     * porcentual. Las claves ausentes en alguno de los periodos se completan con `0`.
     */
    public static async compararPeriodos(propiedad: number, config: IRunReportRequest, actual: IDateRange, anterior: IDateRange): Promise<IReportComparacion[]> {
        const base = {...config};
        delete base.dateRanges;
        const [filasActual, filasAnterior] = await this.runBatchReports(propiedad, [
            {...base, dateRanges: [actual]},
            {...base, dateRanges: [anterior]},
        ]).then((reports) => [
            this.mapKeyValue(reports[0] ?? {}),
            this.mapKeyValue(reports[1] ?? {}),
        ]);

        const valoresAnterior = new Map<string, string>(filasAnterior.map((fila) => [fila.key, fila.value]));
        const claves = new Set<string>([...filasActual.map((fila) => fila.key), ...valoresAnterior.keys()]);
        const valoresActual = new Map<string, string>(filasActual.map((fila) => [fila.key, fila.value]));

        const comparacion: IReportComparacion[] = [];
        for (const key of claves) {
            const actualStr = valoresActual.get(key) ?? "0";
            const anteriorStr = valoresAnterior.get(key) ?? "0";
            const actualNum = Number(actualStr);
            const anteriorNum = Number(anteriorStr);
            comparacion.push({
                key,
                actual: actualStr,
                anterior: anteriorStr,
                delta: actualNum - anteriorNum,
                variacion: anteriorNum === 0 ? null : ((actualNum - anteriorNum) / anteriorNum) * 100,
            });
        }
        return comparacion;
    }
}

export type {
    ICredencialesGA4,
    IDateRange,
    IDimension,
    IMetric,
    IReportComparacion,
    IReportKeyValue,
    IReportRow,
    IRunReportRequest,
    IRunReportResponse,
};
export {GAnalytics4V2};
