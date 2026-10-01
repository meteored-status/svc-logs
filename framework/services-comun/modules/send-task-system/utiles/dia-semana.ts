/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 06:49:18 GMT
 * Hash: 7f854b19d54ed09f32ba23cc4c0fae28
 * Versión: 2026.9.29+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

/**
 * Normalización del campo de día de la semana de los patrones de `Periodicity`.
 *
 * ## Por qué hace falta
 *
 * En cron el domingo es `0` y `7` indistintamente, y `cron-parser` resuelve los dos a `0`. La
 * librería rechaza un campo con valores repetidos **una vez resueltos** (`1,1` siempre ha fallado),
 * pero hasta la 5.10.1 se le escapaba el `0`, así que `0,7` pasaba. Desde la 5.10.1 falla, y hay
 * patrones así guardados.
 *
 * Aquí solo se **lee**: `Periodicity` no persiste el patrón normalizado, lo usa para calcular fechas.
 * El domingo se escribe como `7` por coherencia con quien los genera (`WeekDays` de las newsletters),
 * pero a `cron-parser` le da igual.
 *
 * Es lógica pura, sin imports; lo cubre `spec/send-task-system/utiles/dia-semana.spec.ts`.
 */

/**
 * Forma de átomo del campo de día de la semana que se sabe leer: un número o un rango `a-b`. El
 * resto (`*`, `?`, pasos, `L`, `#`, nombres como `mon`) queda fuera y deja el campo intacto.
 */
const ATOMO = /^(\d+|\d+-\d+)$/;

/**
 * Valores de un campo de día de la semana tal cual vienen, sin resolver el domingo ni quitar
 * repetidos: `1-3,2` da `[1, 2, 3, 2]`.
 *
 * @param campo - Campo de día de la semana, tipo `1,5` o `0-6`.
 * @returns Los valores, o `null` si el campo usa algo que no se sabe leer o que se sale de rango.
 */
function valoresDeCampo(campo: string): number[]|null {
    const valores: number[] = [];
    for (const atomo of campo.split(",")) {
        if (!ATOMO.test(atomo)) {
            return null;
        }
        const [desde, hasta] = atomo.split("-").map((valor) => Number(valor));
        const fin = hasta ?? desde;
        if (desde > 7 || fin > 7 || desde > fin) {
            return null;
        }
        for (let dia = desde; dia <= fin; dia++) {
            valores.push(dia);
        }
    }
    return valores;
}

/**
 * Quita del campo de día de la semana los días repetidos una vez resuelto el domingo, sin tocar el
 * resto del patrón: `1,7,0` pasa a `1,7`; `0-7`, a `1,2,3,4,5,6,7`.
 *
 * **Solo reescribe un campo que tiene repetidos**, que son los que `cron-parser` rechaza; cualquier
 * otro patrón sale tal cual. No es un detalle: un `*` no se puede expandir a `1,…,7`, porque
 * `cron-parser` deja de tratarlo como comodín y, con el día del mes restringido, cron combina los
 * dos campos con OR: `0 9 15 * *` (el día 15) pasaría a dispararse todos los días.
 *
 * @param patron - Patrón de cron de 5 o 6 campos; el día de la semana es siempre el último.
 * @returns El patrón sin días repetidos, que dispara exactamente los mismos días que el original,
 *          o el original si no tenía repetidos o si su campo de día no se sabe leer (en ese caso
 *          decide `cron-parser`).
 */
export function normalizarPatron(patron: string): string {
    const campos = patron.trim().split(/\s+/);
    if (campos.length < 5) {
        return patron;
    }
    const ultimo = campos.length - 1;
    const valores = valoresDeCampo(campos[ultimo]);
    if (valores === null) {
        return patron;
    }
    // El `Set` va sobre el día **ya resuelto**: el domingo es `0` y `7` a la vez.
    const dias = [...new Set(valores.map((dia) => dia === 0 ? 7 : dia))].sort((a, b) => a - b);
    if (dias.length === valores.length) {
        return patron;
    }
    campos[ultimo] = dias.join(",");
    return campos.join(" ");
}
