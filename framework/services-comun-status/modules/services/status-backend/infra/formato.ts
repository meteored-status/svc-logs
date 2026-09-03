/**
 * Editor: Bixus
 * Fecha: Tue, 01 Sep 2026 13:11:20 GMT
 * Hash: 01444981fb9dab135c2e2d5315a6b0eb
 * Versión: 2026.9.1+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Cómo se llama cada métrica cuando se le habla a una persona.
 *
 * La clave técnica (`cdn.data_transfer`) sigue siendo la que une el histórico y la que se cita en un correo o se
 * busca en el índice; lo que va aquí es el nombre con el que se habla de esa línea, que es el que aparece en la
 * propuesta de renovación.
 *
 * **Vive en el framework y no en la pantalla porque lo necesitan los dos lados**, y por la misma razón que
 * `RETRASO_DIAS`: la pantalla lo usa para rotular tarjetas y hallazgos, y el cronjob para escribir el correo de
 * aviso a quien está de guardia. Con una copia en cada sitio, el día que se renombre una línea el correo diría una
 * cosa y la pantalla otra sobre la misma métrica — y quien recibe el correo no tiene forma de saber cuál manda.
 *
 * Una métrica que no esté aquí se enseña por su clave. Es un defecto correcto: si el cronjob empieza a recoger algo
 * nuevo, se pinta igual, solo con un nombre más feo.
 */
export const ETIQUETAS: Record<string, string> = {
    "cdn.data_transfer":          "Transferencia de CDN",
    "cdn.requests":               "Peticiones de CDN",
    "dns.queries":                "Consultas DNS",
    "workers.requests":           "Peticiones de Workers",
    "workers.cpu_time":           "CPU de Workers",
    "workers_kv.reads":           "Lecturas de Workers KV",
    "workers_kv.writes":          "Escrituras de Workers KV",
    "workers_kv.storage":         "Almacenamiento de Workers KV",
    "durable_objects.requests":   "Peticiones de Durable Objects",
    "durable_objects.compute":    "Cómputo de Durable Objects",
    "cache_reserve.storage":      "Almacenamiento de Cache Reserve",
    "cache_reserve.class_a":      "Cache Reserve, operaciones clase A",
    "cache_reserve.class_b":      "Cache Reserve, operaciones clase B",
    "load_balancing.dns_queries": "Consultas DNS de balanceo",
    "load_balancing.requests":    "Peticiones de balanceo",
    "load_balancing.origins":     "Orígenes de balanceo",
    "load_balancing.pools":       "Pools de balanceo",
    "acm.domains":                "Dominios de Advanced Certificate Manager",
    "zones.enterprise":           "Zonas Enterprise",
    "zones.total":                "Zonas totales",
    "rate_limiting.requests":     "Peticiones de rate limiting",
    "access.seats":               "Asientos de Access",
    "gateway.seats":              "Asientos de Gateway",
    "zero_trust.seats":           "Asientos de Zero Trust",
    "devices.warp":               "Dispositivos WARP",
};

/**
 * Cómo se lee una unidad del contrato.
 *
 * `MM` es «millones», así que un valor de 26.244 en `MM` son 26.244 millones. Se respeta la unidad del contrato en
 * vez de normalizar a una sola para que el número que se ve sea **el mismo** que el de la propuesta de renovación.
 */
const UNIDADES: Record<string, string> = {
    "TB": "TB",
    "MB": "MB",
    "MM": "MM",
    "MM_ms": "MM ms",
    "MM_GB_s": "MM GB-s",
    "count": "",
};

/**
 * @property sufijo - Si se pega la unidad al número. Se quita cuando dos valores de la **misma** unidad van en la
 *                    misma frase: «3.699 MM ms de 2.500 MM ms contratados» dice la unidad dos veces para nada, y
 *                    «3.699 de 2.500 MM ms» se lee de un tirón. Los decimales se siguen decidiendo igual, que es la
 *                    razón de que sea un parámetro de aquí y no un formateo aparte.
 */
export interface IFormatoConfig {
    sufijo?: boolean;
}

/**
 * Formatea un valor con su unidad, con los decimales que hagan falta y no más.
 *
 * Las cuentas enteras —asientos, zonas, orígenes— no llevan decimales; el resto sí, porque un 0,3 redondeado a 0 en
 * Cache Reserve clase A leería como «no se usa».
 *
 * **Aquí y no en la pantalla por lo mismo que `ETIQUETAS`**: el correo de aviso tiene que decir exactamente la misma
 * cifra que la tarjeta. Dos implementaciones del redondeo son dos cifras distintas para el mismo consumo, y de las
 * dos la que se cita en una negociación es la que esté a mano.
 *
 * @param valor  El valor.
 * @param unidad La unidad tal cual viaja en la serie.
 * @param config Si se pega la unidad al número.
 */
export const formatear = (valor: number, unidad: string, {sufijo = true}: IFormatoConfig = {}): string => {
    const unidadTexto = UNIDADES[unidad] ?? unidad;
    const decimales = unidad === "count" ? 0 : valor >= 100 ? 0 : valor >= 1 ? 1 : 2;
    const numero = valor.toLocaleString("es-ES", {minimumFractionDigits: decimales, maximumFractionDigits: decimales});

    return sufijo && unidadTexto.length > 0 ? `${numero} ${unidadTexto}` : numero;
}

/** Un mes `YYYY-MM` como se lee: «Agosto de 2026». */
export const etiquetaDeMes = (mes: string): string => {
    const [anio, numero] = mes.split("-").map(actual => Number.parseInt(actual, 10));
    const texto = new Date(Date.UTC(anio, numero-1, 1)).toLocaleDateString("es-ES", {month: "long", year: "numeric", timeZone: "UTC"});

    return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

/** Una fecha `YYYY-MM-DD` como se lee: «31/08/2026». */
export const etiquetaDeDia = (dia: string): string => new Date(`${dia}T00:00:00Z`).toLocaleDateString("es-ES", {day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"});
