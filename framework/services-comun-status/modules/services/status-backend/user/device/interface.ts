/**
 * Editor: Bixus
 * Fecha: Fri, 04 Sep 2026 11:24:52 GMT
 * Hash: 3222d41dc07c6369782107bf1d6ac37e
 * Versión: 2026.9.4+2-bixus
 * Anterior: 2026.9.4+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Registro de un dispositivo para notificaciones push.
 *
 * El token lo da el SDK de FCM en el navegador y **no se valida aquí**: es opaco, cambia de formato con las
 * versiones del SDK, y lo único que dice si vale es intentar enviarle algo. Lo que sí se comprueba es que no
 * venga vacío y que quepa, para no guardar basura en una columna `TEXT`.
 *
 * @property token    - El token, tal cual lo da el SDK.
 * @property platform - Etiqueta para que su dueño lo distinga al revocarlo («iPhone», «Chrome en Mac»). Es
 *                      cosmética: la deduce el cliente del `userAgent` y nada depende de ella.
 */
export interface IDeviceIN {
    token: string;
    platform: string;
}

/**
 * Baja de un dispositivo.
 *
 * Va por token y no por un id propio porque el cliente **solo conoce su token**: el hash con el que se
 * almacena lo calcula el servidor. Y el borrado comprueba de quién es en la propia consulta, así que revocar
 * el de otro no es «encontrarlo y decidir que no», es no encontrarlo.
 *
 * @property token - El token que se da de baja.
 */
export interface IDeviceDeleteIN {
    token: string;
}

/**
 * Un dispositivo registrado, como se enseña en la pantalla de preferencias.
 *
 * **El token no viaja de vuelta.** No hace falta para nada de lo que se pinta, y es lo que permitiría a
 * cualquiera que lea la respuesta mandar notificaciones a ese dispositivo. Lo que identifica una fila para
 * revocarla es su `id`, que es un hash.
 *
 * @property id       - Su clave, para poder revocarlo desde la lista.
 * @property platform - La etiqueta con la que se registró.
 * @property created  - Cuándo se registró por primera vez, en ISO.
 * @property seen     - Última vez que el panel lo confirmó, en ISO.
 * @property propio   - Si es **este** navegador, para que la lista pueda decir «este dispositivo».
 */
export interface IDeviceOUT {
    id: string;
    platform: string;
    created: string;
    seen: string;
    propio?: boolean;
}

/**
 * Los dispositivos de quien lo pide.
 *
 * @property devices - Los que tiene registrados, del más reciente al más viejo.
 */
export interface IDevicesOUT {
    devices: IDeviceOUT[];
}

/**
 * Lo que ha dado de sí la prueba de envío.
 *
 * **Tres números y no un «se ha enviado»** porque con varios dispositivos lo normal es que llegue a unos y a
 * otros no, y eso es justamente lo que se quiere ver al probar. Con un booleano, un móvil viejo que ya no
 * existe dejaría la prueba en «ha fallado» aunque el portátil de delante la haya recibido.
 *
 * `sent` es lo que **FCM aceptó**, no un acuse de entrega: nadie puede decir desde el servidor si la
 * notificación llegó a pintarse. Lo que sí demuestra es que la credencial vale, que el token sigue vivo y que
 * el mensaje salió — que es lo que no se sabía.
 *
 * @property devices - A cuántos dispositivos se intentó.
 * @property sent    - En cuántos aceptó FCM el envío.
 * @property removed - Cuántos se han retirado en el intento porque FCM dice que ya no existen. Si no es cero,
 *                     la lista de dispositivos ha cambiado y hay que recargarla.
 */
export interface IDeviceTestOUT {
    devices: number;
    sent: number;
    removed: number;
}

/**
 * Largo máximo que se acepta para un token.
 *
 * Los de FCM andan por los ciento sesenta caracteres y han crecido con las versiones del SDK, así que el
 * límite es holgado a propósito: sirve para rechazar un cuerpo absurdo, no para validar el formato.
 */
export const TOKEN_MAXIMO = 4096;
