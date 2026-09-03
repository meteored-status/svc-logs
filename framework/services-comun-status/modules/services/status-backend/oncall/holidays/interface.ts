/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 11:11:12 GMT
 * Hash: 5e332c907914b8a852b3498d4c2cb0f7
 * Versión: 2026.8.25+4-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IOnCallHoliday, IOnCallUser} from "../interface";

/**
 * Un festivo tal y como lo pinta la pantalla de calendarios: lo que es y **a quién le toca**.
 *
 * @property user - Quién lo cubre, o ausente. Solo viaja para los festivos de **hoy en adelante**, y eso es
 *                  deliberado: para los pasados habría que reconstruir el reparto con la rueda de ahora, que
 *                  es una deducción y no un dato —quien lo cubrió de verdad está en el registro diario, y la
 *                  ficha de cada persona ya lo enseña con esa distinción hecha—. Una pantalla de gestión del
 *                  calendario no es el sitio para presentar una deducción como un hecho.
 *
 *                  Ausente en un festivo futuro significa otra cosa: que ese día no lo cubre nadie porque
 *                  toda la rueda está saltada, o porque está vacía.
 * @property excluded - `true` si es un día **descartado**: el feed lo trae como festivo y no lo es. No es un
 *                  festivo, así que no cuenta para el reparto y **no le toca a nadie** —ese día lo cubre quien
 *                  tenga la semana, como uno cualquiera—, y por eso nunca viene con `user`.
 *
 *                  Viaja en la misma lista que los festivos de verdad, y no en otra, porque el caso que motiva
 *                  los descartes es un festivo que se traslada: el 6 y el 7 de diciembre tienen que verse
 *                  pegados para entender cuál se descartó y cuál cuenta.
 * @property reason - Por qué se descartó. Solo en los descartados.
 */
export interface IOnCallHolidayDetail extends IOnCallHoliday {
    user?: number;
    excluded?: true;
    reason?: string;
}

/**
 * Todo lo que pinta la pantalla de calendarios de la guardia.
 *
 * @property holidays - **Todos** los festivos registrados desde el origen del ciclo, ordenados por fecha. Van
 *                      todos y no los de un año: el reparto de festivos los cuenta en orden desde el origen,
 *                      así que quien administra esta tabla necesita ver la serie completa para entender por
 *                      qué a alguien le toca el que le toca. El filtro por año lo pone la pantalla, que es
 *                      donde importa la comodidad y no la coherencia del dato.
 * @property wheel    - La rueda en orden, para poner nombre a los ids. Es `IOnCallUser` aunque aquí sobren
 *                      sus listas de turnos —viajan vacías—: es el tipo que ya consumen los componentes de la
 *                      guardia, y definir uno más ligero solo para esta pantalla obligaría a duplicar los
 *                      ayudantes que resuelven nombres y avatares.
 * @property today    - Hoy en la zona de la guardia (`Europe/Madrid`). Lo pone el backend por lo mismo que en
 *                      el resto de la guardia: con el reloj del cliente, la frontera entre «pasado» y «por
 *                      venir» podría caer en otro día que la del reparto.
 */
export interface IHolidaysOUT {
    holidays: IOnCallHolidayDetail[];
    wheel: IOnCallUser[];
    today: string;
}
