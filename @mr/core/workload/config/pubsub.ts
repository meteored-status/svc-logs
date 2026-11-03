/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 53ef6a33cab36997f6219545821c0f31
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

/**
 * Entorno del proceso, tal y como lo leen {@link comprobarEmuladorPubSub} y {@link modoPubSub}.
 */
type TEntorno = Record<string, string|undefined>;

/**
 * Datos de {@link comprobarEmuladorPubSub}.
 *
 * @property produccion - `PRODUCCION` del bundle: `true` en test y en produccion, `false` en desarrollo.
 * @property env - Variables de entorno del proceso.
 */
interface IComprobarEmuladorPubSub {
    produccion: boolean;
    env: TEntorno;
}

/**
 * Modo de Pub/Sub con el que corre el proceso.
 *
 * @property emulador - `host:puerto` del emulador (`PUBSUB_EMULATOR_HOST`), o `null` si el proceso habla con Google Cloud.
 * @property proyecto - Proyecto con el que se habla con el emulador (`PUBSUB_PROJECT_ID`), o `null` si no se ha fijado.
 */
export interface IModoPubSub {
    emulador: string|null;
    proyecto: string|null;
}

/**
 * Impide que un servicio compilado para test o produccion hable con el emulador de Pub/Sub.
 *
 * `@google-cloud/pubsub` cambia por si sola a un canal inseguro contra `PUBSUB_EMULATOR_HOST` y descarta las credenciales de
 * la cuenta de servicio. En un servicio desplegado eso significaria perder todos los mensajes sin ninguna alarma, asi que
 * la variable solo se admite en desarrollo, donde la fija `mrpack devel -p` en los procesos que lanza. Como la libreria, una
 * variable vacia cuenta como no definida.
 *
 * @param config - Entorno de compilacion y del proceso.
 * @throws {Error} Si el bundle es de test o produccion y `PUBSUB_EMULATOR_HOST` esta definida.
 */
export function comprobarEmuladorPubSub({produccion, env}: IComprobarEmuladorPubSub): void {
    const host = env["PUBSUB_EMULATOR_HOST"];

    if (produccion && host) {
        throw new Error(`PUBSUB_EMULATOR_HOST=${host} no esta permitida en un servicio compilado para test o produccion: `
            + `los mensajes de Pub/Sub irian a un emulador y no a Google Cloud. Solo se admite en desarrollo.`);
    }
}

/**
 * Dice si el proceso habla con el emulador de Pub/Sub o con Google Cloud, a partir de las variables que lee
 * `@google-cloud/pubsub`. Una variable vacia cuenta como no definida.
 *
 * Es lo que muestra `GET /admin/pubsub/` y lo que usan los tests e2e para comprobar que un servicio esta levantado en modo emulador.
 *
 * @param env - Variables de entorno del proceso.
 * @returns El emulador y el proyecto, o `null` en el que no este definido.
 */
export function modoPubSub(env: TEntorno): IModoPubSub {
    return {
        emulador: env["PUBSUB_EMULATOR_HOST"] || null,
        proyecto: env["PUBSUB_PROJECT_ID"] || null,
    };
}
