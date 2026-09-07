/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 14:26:51 GMT
 * Hash: ba96b7aa265cd2815a47c1a724079912
 * Versión: 2026.9.7+2-bixus
 * Anterior: 2026.9.3+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {etiquetaDeDia, etiquetaDeMes, formatear, porcentaje} from "../formato";
import {EHallazgo, type IHallazgoOUT} from "./interface";
import {ESeveridad} from "./interface";

/**
 * Cómo se llama cada severidad cuando hay que decirla con palabras.
 *
 * **Se queda como código, no como texto.** Antes eran las palabras castellanas: lo dicen dos sitios —el panel, en el
 * encabezado de cada grupo, y el correo a quien está de guardia— y el framework no sabe en qué idioma se van a leer.
 * El valor coincide con el del enum a propósito: es la clave con la que cada consumidor busca su traducción.
 *
 * El **color** de cada severidad no está aquí a propósito: eso es de la pantalla, y en un correo no significa nada.
 */
export const ETIQUETA_SEVERIDAD: Record<ESeveridad, string> = {
    [ESeveridad.ALTA]:  ESeveridad.ALTA,
    [ESeveridad.MEDIA]: ESeveridad.MEDIA,
    [ESeveridad.BAJA]:  ESeveridad.BAJA,
};

/**
 * Qué frase le toca a un hallazgo.
 *
 * Son más que los nueve `EHallazgo` porque **aquí se deciden las ramas**: un exceso se cuenta distinto si es de un
 * mes cerrado o de un nivel de hoy, un escalón según si subió o bajó, un pico según si está por encima o por debajo
 * de su vecindad, y una línea sin tope según si además se está midiendo. Esa decisión depende de los datos, así que
 * es del análisis y no de quien pinta — que es justo lo que permite que el panel y el correo no la repitan cada uno
 * a su manera.
 */
export const enum EFrase {
    EXCESO_MES         = "exceso-mes",
    EXCESO_NIVEL       = "exceso-nivel",
    PROYECCION         = "proyeccion",
    AVISO_MES          = "aviso-mes",
    AVISO_NIVEL        = "aviso-nivel",
    ESCALON_SUBIO      = "escalon-subio",
    ESCALON_BAJO       = "escalon-bajo",
    PICO_ENCIMA        = "pico-encima",
    PICO_DEBAJO        = "pico-debajo",
    FUERA_CONTRATO     = "fuera-contrato",
    SIN_TOPE_CON_VALOR = "sin-tope-con-valor",
    SIN_TOPE           = "sin-tope",
    HUECO              = "hueco",
    PARADA             = "parada",
}

/** Qué matiz le toca, cuando hay algo que matizar. */
export const enum ENota {
    EXCESO_MES       = "exceso-mes",
    EXCESO_NIVEL     = "exceso-nivel",
    PROYECCION       = "proyeccion",
    AVISO_MES        = "aviso-mes",
    AVISO_NIVEL      = "aviso-nivel",
    ESCALON          = "escalon",
    PICO_PROVISIONAL = "pico-provisional",
    FUERA_CONTRATO   = "fuera-contrato",
    SIN_TOPE         = "sin-tope",
    HUECO            = "hueco",
    PARADA           = "parada",
}

/**
 * Qué se dice de un hallazgo: **el código de la frase y el de la nota, no las frases**.
 *
 * Esto era antes un componedor de frases castellanas con los números ya formateados, y estaba mal de raíz: un
 * paquete de framework no sabe —ni puede saber— en qué idioma se van a leer, y encima formateaba con `"es-ES"`
 * clavado, así que el panel en inglés y el correo en francés salían con puntos de millar españoles.
 *
 * Ahora el reparto es el que ya rige en el resto del contrato: **viajan números, no frases**. El análisis decide
 * *qué* hay que decir y quien pinta decide *cómo se escribe* y **con qué locale se formatea**. Los números no hacen
 * falta aquí porque ya viajan en el propio `IHallazgoOUT`: `value`, `reference`, `percent`, `days`, `month` y `date`.
 *
 * Y el nombre de la línea del contrato tampoco: era `ETIQUETAS[metric]`, otra lista castellana. El consumidor lo
 * resuelve de `metric`, que es lo que identifica la línea.
 *
 * @property frase - Qué le pasa.
 * @property nota  - Lo que hay que matizar. Ausente en un pico que no sea provisional, que es el único caso sin
 *                   matiz que añadir.
 */
export interface ITexto {
    frase: EFrase;
    nota?: ENota;
}

export const texto = (hallazgo: IHallazgoOUT): ITexto => {
    const {kind, month, percent, provisional, value} = hallazgo;

    switch (kind) {
        case EHallazgo.EXCESO:
            // Con `month` es un mes cerrado y completo; sin él, un nivel medido hoy. No es el mismo hecho: uno ya
            // pasó y el otro está pasando, así que no se pueden contar con la misma frase.
            return month !== undefined
                ? {frase: EFrase.EXCESO_MES, nota: ENota.EXCESO_MES}
                : {frase: EFrase.EXCESO_NIVEL, nota: ENota.EXCESO_NIVEL};

        case EHallazgo.PROYECCION:
            return {frase: EFrase.PROYECCION, nota: ENota.PROYECCION};

        case EHallazgo.AVISO:
            return month !== undefined
                ? {frase: EFrase.AVISO_MES, nota: ENota.AVISO_MES}
                : {frase: EFrase.AVISO_NIVEL, nota: ENota.AVISO_NIVEL};

        case EHallazgo.ESCALON:
            // El signo se dice **con palabras** y el número viaja positivo: un «un −72,7%» obliga a interpretar dos
            // convenciones a la vez. Por eso son dos códigos y no uno con el signo dentro.
            return {frase: (percent ?? 0) >= 0 ? EFrase.ESCALON_SUBIO : EFrase.ESCALON_BAJO, nota: ENota.ESCALON};

        case EHallazgo.PICO:
            return {
                frase: (percent ?? 0) >= 0 ? EFrase.PICO_ENCIMA : EFrase.PICO_DEBAJO,
                // Solo en los últimos días de la serie: ahí todavía no se sabe si es un día suelto o el principio de
                // un escalón, y decirlo es lo que evita llegar tarde a lo único que da tiempo a arreglar.
                ...provisional === true ? {nota: ENota.PICO_PROVISIONAL} : {},
            };

        case EHallazgo.FUERA_CONTRATO:
            return {frase: EFrase.FUERA_CONTRATO, nota: ENota.FUERA_CONTRATO};

        case EHallazgo.SIN_TOPE:
            // Con medida se puede decir cuánto se está gastando fuera de contrato; sin ella, solo que falta el tope.
            return {frase: value !== undefined ? EFrase.SIN_TOPE_CON_VALOR : EFrase.SIN_TOPE, nota: ENota.SIN_TOPE};

        case EHallazgo.HUECO:
            return {frase: EFrase.HUECO, nota: ENota.HUECO};

        case EHallazgo.PARADA:
            return {frase: EFrase.PARADA, nota: ENota.PARADA};
    }
}

/**
 * Lo que el compositor necesita de un `TranslationMap`, **descrito por su forma y no importado**.
 *
 * Es lo que permite que esto viva en el framework: `services-comun-status` tiene cero dependencias y el workspace
 * `i18n` no llega aquí, así que no se puede importar `TranslationMap`. Declarando solo el método que se usa, el
 * módulo de traducción encaja por estructura — y el framework sigue sin depender de nada.
 */
export interface IMapaTexto {
    uGet(clave: string, params?: Record<string, string|number>): string;
}

/**
 * Lo que hace falta para escribir un hallazgo.
 *
 * @property frases       - Las frases, indexadas por `EFrase`. Las que cuentan días llevan sus formas de plural
 *                          dentro y las resuelve el propio map, que declara `dias` como contador.
 * @property notas        - Las notas, indexadas por `ENota`.
 * @property lineas       - Los nombres de las líneas del contrato, indexados por métrica.
 * @property locale       - Con qué idioma se formatean números y fechas. **No** decide el texto: eso lo deciden los
 *                          módulos que se pasan, que ya vienen en el idioma que toca.
 */
export interface IEscritura {
    frases: IMapaTexto;
    notas: IMapaTexto;
    lineas: IMapaTexto;
    locale: string;
}

/**
 * @property titulo - La línea del contrato, como se llama en la propuesta de renovación.
 * @property frase  - Qué le pasa, con sus números.
 * @property nota   - Lo que hay que matizar, cuando hay algo que matizar.
 * @property coste  - Lo que cuesta el exceso, **ya formateado en dólares**. Ausente cuando no hay exceso que cobrar
 *                    o cuando el contrato no tarifa esa línea, que no es lo mismo que salir gratis.
 *
 *                    Va como campo aparte y no metido en la frase por dos razones. Una: solo lo llevan dos de los
 *                    catorce códigos de frase, así que meterle un `{{coste}}` a las plantillas obligaría a que
 *                    todas lo tuvieran o a duplicar las dos que sí. Y dos: el porcentaje y el dinero se leen
 *                    distinto —uno dice cuánto te has pasado y el otro cuánto cuesta—, así que quien pinta querrá
 *                    darles sitios distintos, y en un correo puede querer que el dinero vaya en negrita.
 */
export interface IHallazgoEscrito {
    titulo: string;
    frase: string;
    nota?: string;
    coste?: string;
}

/**
 * El importe de un exceso, en dólares y con el separador de miles del idioma que se está leyendo.
 *
 * **En dólares y no en euros**, porque el acuerdo está en dólares: pasarlo aquí obligaría a inventarse un tipo de
 * cambio y a que la cifra no cuadrase con la factura de Cloudflare.
 *
 * Sin decimales a partir de 100 y con dos por debajo. Es una estimación —el consumo de un mes por el precio de una
 * unidad—, así que dar «1.234,56 $» aparenta una precisión que no tiene; pero en un exceso de tres dólares los
 * céntimos son la mitad del número.
 *
 * @param importe El importe en dólares.
 * @param locale  El idioma con el que se separan los miles.
 */
const dinero = (importe: number, locale: string): string => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: importe >= 100 ? 0 : 2,
}).format(importe);

/**
 * Un número con su unidad, o una raya si no hay dato.
 *
 * Lo único que añade sobre el `formatear()` del formateador compartido es el `undefined`, que aquí llega —hay
 * hallazgos sin valor de referencia— y allí no tendría sentido. Todo lo demás —los decimales por magnitud, la
 * tabla de unidades, el sufijo— **era una copia literal** de esa función con el locale metido a mano, escrita
 * cuando `formatear()` todavía formateaba con `"es-ES"` fijo y por tanto no se podía reutilizar. Ahora sí.
 */
const medida = (valor: number|undefined, unidad: string, locale: string, {sufijo = true}: {sufijo?: boolean} = {}): string =>
    valor === undefined ? "—" : formatear(valor, unidad, locale, {sufijo});

/**
 * Escribe un hallazgo con los textos y el idioma que se le pasen.
 *
 * **Está aquí y no en cada consumidor** porque lo escriben dos: el panel y el correo a quien está de guardia, y
 * tienen que decir lo mismo. Lo que no está aquí son los textos: llegan en `IEscritura`, ya en el idioma que toca,
 * descritos por su forma para que el framework siga sin depender del workspace `i18n`.
 *
 * Y **no vuelve a decidir ramas**: eso lo hizo `texto()`. Si aquí hubiera otro `percent >= 0` para elegir entre
 * «subió» y «bajó», la regla estaría en dos sitios y acabarían discrepando.
 */
export const escribir = (hallazgo: IHallazgoOUT, escritura: IEscritura): IHallazgoEscrito => {
    const {metric, unit, value, reference, percent, month, days, date, cost} = hallazgo;
    const {frases, notas, lineas, locale} = escritura;
    const codigos = texto(hallazgo);

    const fecha = etiquetaDeDia(date, locale);
    const params: Record<string, string|number> = {
        mes: month !== undefined ? etiquetaDeMes(month, locale) : "",
        fecha,
        valor: medida(value, unit, locale),
        tope: medida(reference, unit, locale),
        pct: porcentaje(percent ?? 0, locale),
        // Sin unidad: la lleva ya el valor con el que se compara, en la misma frase.
        vecindad: medida(reference, unit, locale, {sufijo: false}),
        antes: medida(reference, unit, locale, {sufijo: false}),
        ahora: medida(value, unit, locale),
        // **Crudo, no compuesto.** Es el contador del map (`counter: "dias"`), así que las frases que cuentan
        // días —parada, hueco, proyección— llevan sus dos formas dentro y el plural se resuelve al pintarlas. Antes
        // llegaba aquí ya escrito («hace cinco días») en tres entradas auxiliares, porque un plural no sabía cuál
        // de varios parámetros era el número; con eso arreglado en `27737165`, la frase entera vuelve a ser una
        // sola unidad traducible en vez de tres trozos cosidos.
        dias: days ?? 0,
    };

    return {
        titulo: lineas.uGet(metric),
        frase: frases.uGet(codigos.frase, params),
        ...codigos.nota !== undefined ? {nota: notas.uGet(codigos.nota, {fecha})} : {},
        ...cost !== undefined ? {coste: dinero(cost, locale)} : {},
    };
}
