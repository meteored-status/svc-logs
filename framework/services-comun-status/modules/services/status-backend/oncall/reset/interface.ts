/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 10:03:08 GMT
 * Hash: bc11aa5ef170fabd2756f412ae8c7198
 * Versión: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EOnCallCycle} from "../interface";

/**
 * Reseteo de un ciclo: mueve el punto desde el que se cuenta para poder decir «a partir de aquí le toca a
 * este», sin reordenar la rueda —que movería a todo el mundo—.
 *
 * A qué momento se ancla lo decide el backend según el ciclo, y no viene en el cuerpo a propósito: es lo
 * único que tiene sentido en cada caso y dejarlo elegir solo abriría la puerta a anclas en fechas que no
 * son ni un lunes ni un festivo.
 *
 * - `WEEK`    — a la **semana en curso**: la elegida pasa a tener esta semana y el ciclo sigue desde ahí.
 * - `HOLIDAY` — al **próximo festivo** que haya, que es lo que se quiere decir al resetear los festivos.
 *
 * @property cycle - Qué ciclo se resetea. Los dos son independientes: resetear el semanal no mueve el de
 *                   festivos ni al contrario.
 * @property user  - A quién le toca a partir de ese momento. Tiene que estar en la rueda.
 */
export interface IResetIN {
    cycle: EOnCallCycle;
    user: number;
}
