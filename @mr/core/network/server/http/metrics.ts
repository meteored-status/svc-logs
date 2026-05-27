/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: 985bb90fae96a7a7dbb757310dcecb16
 * Versión: 2026.5.18+2-josantoniojimnez
 */

/**
 * Métricas mínimas del servidor HTTP, exportables en formato Prometheus text.
 *
 * Diseñado sin dependencias externas para evitar añadir peso al runtime de producción.
 * Si en el futuro se necesitan métricas más elaboradas (labels arbitrarios, summaries,
 * exemplars de trazas, etc.) conviene migrar a `prom-client`.
 *
 * ### Métricas expuestas
 *
 * - `http_requests_total{method, status}` — contador acumulado de peticiones servidas.
 * - `http_request_errors_total{method}`   — contador acumulado de respuestas `>= 500`.
 * - `http_request_duration_ms`            — histograma con `_bucket`, `_sum`, `_count`
 *   (latencia extremo-a-extremo en milisegundos por petición).
 * - `http_process_uptime_seconds`         — gauge con el uptime del proceso.
 *
 * ### Uso
 *
 * ```ts
 * metricas.observe("GET", 200, 12.4);
 * const texto = metricas.formatPrometheus();
 * ```
 */
class Metricas {
    /* STATIC */

    /**
     * Buckets (acumulativos) en milisegundos para el histograma de latencia.
     * Cubren desde 5 ms hasta 10 s; suficiente para servicios web típicos.
     */
    private static readonly BUCKETS_MS: readonly number[] = [
        5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
    ];

    /* INSTANCE */

    /** Marca de tiempo de creación, para calcular uptime del proceso. */
    private readonly inicio: number;

    /** Contador por `method|status`. */
    private readonly requestsTotal: Map<string, number>;

    /** Contador de errores 5xx por método. */
    private readonly requestErrorsTotal: Map<string, number>;

    /** Buckets acumulativos del histograma de latencia. */
    private readonly latencyBuckets: Map<number, number>;

    /** Total de peticiones observadas en el histograma. */
    private latencyCount: number;

    /** Suma de duraciones observadas (ms) para `_sum`. */
    private latencySum: number;

    public constructor() {
        this.inicio = Date.now();
        this.requestsTotal = new Map<string, number>();
        this.requestErrorsTotal = new Map<string, number>();
        this.latencyBuckets = new Map<number, number>();
        this.latencyCount = 0;
        this.latencySum = 0;
    }

    /**
     * Registra una petición servida. Llamado típicamente desde el listener
     * `response.on("finish" | "close")` para cubrir tanto respuestas completas
     * como conexiones cerradas anticipadamente.
     *
     * @param method     - Método HTTP de la petición.
     * @param status     - Código de estado HTTP de la respuesta.
     * @param durationMs - Duración total de la petición en milisegundos.
     */
    public observe(method: string, status: number, durationMs: number): void {
        const claveReq = `${method}|${status}`;
        this.requestsTotal.set(claveReq, (this.requestsTotal.get(claveReq) ?? 0) + 1);

        if (status >= 500) {
            this.requestErrorsTotal.set(
                method,
                (this.requestErrorsTotal.get(method) ?? 0) + 1,
            );
        }

        this.latencyCount += 1;
        this.latencySum += durationMs;
        for (const bucket of Metricas.BUCKETS_MS) {
            if (durationMs <= bucket) {
                this.latencyBuckets.set(bucket, (this.latencyBuckets.get(bucket) ?? 0) + 1);
            }
        }
    }

    /**
     * Serializa todas las métricas en formato Prometheus text exposition (v0.0.4).
     * El cuerpo resultante debe servirse con `Content-Type: text/plain; version=0.0.4`.
     */
    public formatPrometheus(): string {
        const out: string[] = [];

        out.push("# HELP http_requests_total Total HTTP requests served.");
        out.push("# TYPE http_requests_total counter");
        for (const [clave, valor] of this.requestsTotal) {
            const [method, status] = clave.split("|");
            out.push(`http_requests_total{method="${escape(method ?? "")}",status="${escape(status ?? "")}"} ${valor}`);
        }

        out.push("# HELP http_request_errors_total Total HTTP responses with status >= 500.");
        out.push("# TYPE http_request_errors_total counter");
        for (const [method, valor] of this.requestErrorsTotal) {
            out.push(`http_request_errors_total{method="${escape(method)}"} ${valor}`);
        }

        out.push("# HELP http_request_duration_ms HTTP request end-to-end duration in milliseconds.");
        out.push("# TYPE http_request_duration_ms histogram");
        for (const bucket of Metricas.BUCKETS_MS) {
            const valor = this.latencyBuckets.get(bucket) ?? 0;
            out.push(`http_request_duration_ms_bucket{le="${bucket}"} ${valor}`);
        }
        out.push(`http_request_duration_ms_bucket{le="+Inf"} ${this.latencyCount}`);
        out.push(`http_request_duration_ms_sum ${this.latencySum}`);
        out.push(`http_request_duration_ms_count ${this.latencyCount}`);

        out.push("# HELP http_process_uptime_seconds Process uptime in seconds.");
        out.push("# TYPE http_process_uptime_seconds gauge");
        out.push(`http_process_uptime_seconds ${((Date.now() - this.inicio) / 1000).toFixed(3)}`);

        return `${out.join("\n")}\n`;
    }
}

/**
 * Escapa los caracteres especiales (`\`, `"`, `\n`) en valores de label
 * según la especificación del formato text exposition de Prometheus.
 */
function escape(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
}

/**
 * Singleton de métricas usado por `Server.onRequest` y el handler `/admin/metrics/`.
 */
export const metricas = new Metricas();


