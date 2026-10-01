/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:00 GMT
 * Hash: c69c83d1013d615c6ba8a4c603377b8d
 * Versión: 2026.9.11+1-bixus
 * Anterior: 2026.9.10+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Un escalón de capacidad: desde cuándo un disco mide lo que mide.
 *
 * Viajan **todos** y no solo el vigente, por lo mismo que los topes de Cloudflare: un rango largo puede abarcar
 * una ampliación, y una única línea de capacidad sobre esa gráfica sería falsa en la mitad de ella. Quien pinta
 * resuelve la capacidad de cada punto por su fecha, y así una ampliación se ve como el escalón que es en vez de
 * como una bajada del uso.
 *
 * @property effectiveDate - Primer día en que rige, `YYYY-MM-DD`.
 * @property total         - Capacidad en bytes.
 * @property description   - Por qué cambió. Puede venir vacía.
 */
export interface IDiskCapacityOUT {
    effectiveDate: string;
    total: number;
    description: string;
}

/**
 * Un disco en la lista.
 *
 * @property disk  - Nombre del disco, que es su identidad: es con lo que se agrupa el histórico.
 * @property from  - Primera medida que hay, ISO 8601.
 * @property to    - Última medida que hay, ISO 8601. **Es el dato que dice si un disco dejó de informar**, y por
 *                   eso se manda siempre: sin él, un disco parado hace tres meses se lee igual que uno al día.
 * @property used  - Ocupación en esa última medida, en bytes.
 * @property total - Capacidad vigente el día de esa última medida, si se conoce. **Ausente** cuando no hay
 *                   ninguna fecha de efecto que la cubra, que es distinto de valer cero: significa que nadie ha
 *                   apuntado el tamaño de ese disco, y la pantalla lo dice en vez de pintar un 100%.
 */
export interface IDiskOUT {
    disk: string;
    from: string;
    to: string;
    used: number;
    total?: number;
}

/**
 * Los discos con histórico.
 *
 * @property disks - Uno por disco, del que más ocupa al que menos.
 */
export interface IDiskListOUT {
    disks: IDiskOUT[];
}

/**
 * Un punto de la serie.
 *
 * @property date - Día, `YYYY-MM-DD`.
 * @property used - Ocupación de ese día, en bytes. Es el **máximo** del día y no la suma: la ocupación es un
 *                  nivel, no un caudal, así que sumar los dos envíos de un día daría el doble de lo que ocupa.
 */
export interface IDiskPointOUT {
    date: string;
    used: number;
}

/**
 * Lo que hay colgado de una ruta y cuánto ha cambiado en el rango pedido.
 *
 * @property path   - Ruta del hijo, con la que se puede volver a preguntar para seguir bajando.
 * @property label  - Rótulo que mandó el emisor.
 * @property before - Ocupación en la primera medida del rango, o `null` si la carpeta no estaba entonces.
 *                    **`null` no es cero**: una carpeta creada a mitad del rango no ha crecido desde cero, ha
 *                    aparecido, y restar contra cero la pondría arriba en la lista de culpables por su tamaño
 *                    entero.
 * @property now    - Ocupación en la última medida del rango.
 * @property leaf   - Si la carpeta **no** tiene nada colgando. Viaja porque la pantalla lo necesita antes de
 *                    pintar la fila: sin él, la única forma de saber si bajar lleva a alguna parte es bajar,
 *                    y una tabla en la que la mitad de los enlaces no llevan a nada enseña a no pulsar
 *                    ninguno. Se calcula sobre el mismo rango que el reparto, así que una carpeta que tuvo
 *                    hijos antes del rango y ya no cuenta como hoja — que es lo que se está enseñando.
 */
export interface IDiskChildOUT {
    path: string;
    label: string;
    before: number|null;
    now: number;
    leaf: boolean;
}

/**
 * La evolución de un nodo y el reparto de lo que tiene debajo.
 *
 * Las dos cosas en una respuesta y no en dos endpoints **a propósito**: la pantalla enseña la línea y la tabla de
 * «quién ha crecido» del mismo disco, la misma ruta y el mismo rango, así que separarlas serían dos viajes y la
 * posibilidad de que una llegue de un rango y la otra de otro.
 *
 * @property disk       - Disco.
 * @property path       - Ruta pedida. `"/"` es el disco entero.
 * @property points     - La serie diaria, en orden. Los días sin medida vienen **ausentes**, no a cero: un día
 *                        sin medir no es un disco vacío, y alinear el rango es trabajo de quien pinta, que es
 *                        quien sabe si el hueco se dibuja como corte o como interpolación.
 * @property capacities - Los escalones de capacidad del disco, ordenados. Vacío si nadie ha apuntado su tamaño.
 * @property breakdown  - La serie diaria de cada carpeta que cuelga, para poder pintar la ocupación
 *                        desglosada en vez de como un total. **Recortada a las que más ocupan**, que es una
 *                        cota de legibilidad: una gráfica apilada con cincuenta segmentos es una mancha. Lo
 *                        que se queda fuera no se pierde — quien pinta lo agrupa en un «otros» restando de
 *                        `points`, que sí es el total entero. Vacío en una hoja.
 * @property children   - El reparto por hijos con su cambio en el rango. Vacío en una hoja, y es así como la
 *                        pantalla sabe que ahí ya no se puede bajar más.
 */
export interface IDiskSerieOUT {
    disk: string;
    path: string;
    points: IDiskPointOUT[];
    capacities: IDiskCapacityOUT[];
    children: IDiskChildOUT[];
    breakdown: IDiskBreakdownOUT[];
}

/**
 * La serie diaria de una de las carpetas que cuelgan del nodo.
 *
 * @property path   - Ruta de la carpeta, la misma que en `children`.
 * @property label  - Rótulo que mandó el emisor en su última medida.
 * @property points - Su serie, con los mismos criterios que la del nodo: un punto por día, el **máximo** del
 *                    día, y los días sin medida **ausentes**. Alinear los huecos es trabajo de quien pinta,
 *                    igual que con `points`.
 */
export interface IDiskBreakdownOUT {
    path: string;
    label: string;
    points: IDiskPointOUT[];
}

/**
 * Alta o corrección de un escalón de capacidad.
 *
 * **La misma entrada para las dos cosas**, porque en la tabla lo son: la clave es `(disk, effectiveDate)`, así
 * que mandar una fecha que ya existe corrige lo que hubiera. Quien llama no tiene que saber si existe.
 *
 * @property disk          - Nombre del disco, **exactamente** como llega por la ingesta. No hay clave ajena que
 *                           lo valide —los discos existen porque alguien publica su ocupación, y esa lista sale
 *                           de Elasticsearch—, así que una errata aquí no falla: crea un escalón que no se
 *                           aplica a ningún disco y el panel sigue diciendo que no hay capacidad apuntada.
 * @property effectiveDate - Primer día en que rige, `YYYY-MM-DD`.
 * @property total         - Capacidad en **bytes**, la misma unidad que `used`, para que el porcentaje sea una
 *                           división sin conversiones. Un entero positivo: un disco de cero bytes daría un 100%
 *                           de ocupación en cada punto, que es una afirmación y no un hueco.
 * @property description   - Por qué cambió: «ampliación a 20 TiB», «corrección de lo apuntado»… Opcional, y
 *                           vacía por defecto. Dentro de dos años, una fecha con un tamaño y sin motivo no dice
 *                           si fue una ampliación, una migración o un arreglo.
 */
export interface IDiskCapacitySaveIN {
    disk: string;
    effectiveDate: string;
    total: number;
    description?: string;
}

/**
 * Borrado de un escalón de capacidad.
 *
 * @property disk          - Nombre del disco.
 * @property effectiveDate - Fecha de efecto a borrar, `YYYY-MM-DD`.
 */
export interface IDiskCapacityDeleteIN {
    disk: string;
    effectiveDate: string;
}
