/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 6d991c374c62c184d258a3206c9dfdc3
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.17+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EAgrupacion} from "../url/interface";

/**
 * Un filtro de URL guardado.
 *
 * @property id          - Identificador. Es con lo que se borra: la descripción también es única, pero mandar el
 *                         texto obligaría a que coincidiera al carácter con lo guardado, y un renombrado a
 *                         medias entre dos pestañas mandaría el borrado a otra fila o a ninguna.
 * @property proyecto    - A qué proyecto aplica.
 * @property subproyecto - A qué subproyecto. **Ausente significa que vale para todo el proyecto**, y los dos
 *                         casos existen: en `tiempo` los filtros son por subproyecto —cada regional tiene sus
 *                         secciones— y en `mr` serán de proyecto. La pantalla lo marca, porque no es lo mismo
 *                         borrar un filtro de un país que uno que usan los veinticinco.
 * @property descripcion - Cómo se llama en la lista. Única dentro del ámbito.
 * @property patron      - La expresión regular, en la sintaxis **RE2** de BigQuery: sin lookahead ni referencias
 *                         hacia atrás, y `(?i)` al principio para ignorar mayúsculas.
 * @property negado      - Si el filtro se aplica **al revés**: quedarse con lo que *no* casa. Viaja con el patrón
 *                         por lo mismo que `agrupacion`, y perderlo sería peor: un filtro negado aplicado en
 *                         positivo no da una tabla vacía —que se ve— sino el conjunto contrario, con unos totales
 *                         creíbles. **Viene siempre**, también en `false`: un booleano opcional obligaría a cada
 *                         consumidor a recordar que la ausencia es «no».
 * @property agrupacion  - Sobre qué columna se aplica. Viaja con el patrón porque un `utm_` solo dice algo sobre
 *                         la URL completa: al aplicar el filtro, la pantalla mueve también el conmutador.
 */
export interface ISeoFilterOUT {
    id: number;
    proyecto: string;
    subproyecto?: string;
    descripcion: string;
    patron: string;
    negado: boolean;
    agrupacion: EAgrupacion;
}

/**
 * Los filtros guardados.
 *
 * **Compartidos y no por usuario**, que es la decisión de fondo: «noticias» o «campañas» son lo mismo para todo
 * el que mira los mismos sitios, así que una lista por persona obligaría a cada uno a reconstruirla. Eso los
 * convierte en configuración de la sección, y por tanto se auditan y necesitan permiso para escribir.
 *
 * @property filters - Los que aplican al ámbito consultado: los **del subproyecto** más los **de todo el
 *                     proyecto**, con los específicos primero. Esa unión es lo que hace que los dos casos
 *                     convivan sin elegir uno para todos. Dentro de cada grupo, alfabético: es una lista corta
 *                     que se lee buscando uno concreto, y para eso el orden útil es el que ya sabes.
 */
export interface ISeoFiltersOUT {
    filters: ISeoFilterOUT[];
}

/**
 * Guarda un filtro, o corrige el que ya tenga esa descripción.
 *
 * Guardar dos veces con el mismo nombre **actualiza** en vez de fallar por duplicado, y eso es deliberado: es el
 * ciclo real de afinar una regex — se prueba, se guarda, se ve que faltaba un caso, se corrige y se vuelve a
 * guardar igual.
 *
 * **El patrón no se valida al guardar.** Solo la consulta sabe si una regex vale, porque BigQuery usa RE2 y
 * JavaScript no acepta lo mismo. De ahí que la pantalla guarde **después** de haber visto el filtro funcionar.
 *
 * @property proyecto    - A qué proyecto aplica.
 * @property subproyecto - A qué subproyecto, o ausente para que valga en todo el proyecto.
 * @property descripcion - Cómo se llama. Junto con el ámbito es la clave a efectos de actualizar.
 * @property patron      - La expresión regular.
 * @property negado      - Si se aplica al revés. **Ausente es `false`**, y se guarda igualmente: al corregir un
 *                         filtro se reescribe la columna, así que quitarle la negación es mandarlo en `false` —no
 *                         omitirlo—.
 * @property agrupacion  - Sobre qué columna se aplica.
 */
export interface ISeoFilterSaveIN {
    proyecto: string;
    subproyecto?: string;
    descripcion: string;
    patron: string;
    negado?: boolean;
    agrupacion: EAgrupacion;
}

/**
 * Borra un filtro guardado.
 *
 * @property id - Identificador del filtro.
 */
export interface ISeoFilterDeleteIN {
    id: number;
}
