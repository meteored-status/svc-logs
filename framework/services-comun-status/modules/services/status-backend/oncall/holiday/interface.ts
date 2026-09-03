/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 11:11:12 GMT
 * Hash: d8362cb8c739afd2e12d9c9e7a46417b
 * Versión: 2026.8.25+4-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Alta y baja de un festivo desde el panel.
 *
 * Solo se administran los **manuales**. El feed de Murcia trae los nacionales y los regionales, y los
 * reescribe en cada pasada del cronjob; las dos fiestas locales las fija cada ayuntamiento y no vienen en
 * ningún sitio, así que son las que se dan de alta por aquí.
 *
 * Ojo con lo que significa tocar esta tabla, porque no es solo una etiqueta en el calendario: **los festivos
 * tienen su propia rueda y se cuentan en orden**, así que dar de alta o borrar uno cambia a quién le tocan los
 * siguientes. Es el mismo efecto que reordenar la rueda, y por eso pide el permiso de escritura de la guardia
 * y no uno de «calendario».
 */

/**
 * @property date - El día, `YYYY-MM-DD`. Es la clave de la tabla: si ya hay un festivo ese día, el alta se
 *                  rechaza en vez de pisarlo — sobrescribir uno del feed lo dejaría fuera del alcance de la
 *                  importación, que solo toca los suyos, y el nombre se quedaría congelado sin que nadie
 *                  supiera por qué.
 * @property name - Nombre visible. Obligatorio: un festivo sin nombre en la planificación es un día en ámbar
 *                  que nadie sabe por qué está marcado.
 */
export interface IHolidayIN {
    date: string;
    name: string;
}

/**
 * Baja de un festivo.
 *
 * @property date - El día. Solo se pueden borrar los **manuales**: los del feed volverían en la siguiente
 *                  pasada del cronjob, así que el botón solo prometería algo que no se cumple.
 */
export interface IHolidayDeleteIN {
    date: string;
}

/**
 * Descarte de un día que el feed trae como festivo y **no lo es**.
 *
 * El caso que lo motiva: cuando un festivo nacional **se traslada** —el 6 de diciembre que pasa al 7—, el feed
 * publica los dos días. El de sobra no es una etiqueta de más: los festivos se reparten contando en orden, así
 * que corre el contador y le cambia el festivo a todo el mundo a partir de ahí.
 *
 * No es lo mismo que borrarlo, y de ahí que sea otro endpoint: borrar la fila no vale porque la importación
 * reescribe todas las suyas en cada pasada y el día volvería esa misma noche. El descarte se apunta en una
 * lista que la importación **se salta**, así que aguanta.
 *
 * Solo se descartan los del feed: un festivo manual se borra, que para eso está.
 *
 * @property date   - El día, `YYYY-MM-DD`. Tiene que estar dado de alta **como festivo del feed**.
 * @property reason - Por qué no es festivo. Obligatorio: descartar un día le cambia el festivo a media rueda,
 *                    así que dentro de un año alguien preguntará, y «se traslada al 7» es la diferencia entre
 *                    un dato y un misterio.
 */
export interface IHolidayExcludeIN {
    date: string;
    reason: string;
}

/**
 * Deshace un descarte: el día vuelve a ser festivo, y con el nombre que traía. Se reinserta en el momento y no
 * esperando a la siguiente pasada del cronjob, para que quien pulse el botón vea el efecto.
 *
 * @property date - El día descartado.
 */
export interface IHolidayRestoreIN {
    date: string;
}
