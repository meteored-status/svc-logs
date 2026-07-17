/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 3546aa48534a28433923784c1a87f9c4
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.26+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {Deferred} from "services-comun/modules/utiles/promise";

import {Colors} from "../colors";
import {Render, prepararTTY, restaurarTTY} from "../../utiles/tty";

/**
 * Opción de un menú de selección simple.
 *
 * @property label       - Texto visible de la opción.
 * @property value       - Valor devuelto si se selecciona la opción.
 * @property descripcion - Texto secundario opcional mostrado en gris.
 * @property disabled    - Si `true`, la opción no es seleccionable y se muestra atenuada.
 */
export interface IMenuOpcion<T> {
    label: string;
    value: T;
    descripcion?: string;
    disabled?: boolean;
}

/**
 * Casilla individual dentro de una fila de {@link alternarMatriz}.
 *
 * @property key     - Clave que identifica la casilla en el resultado devuelto.
 * @property label   - Texto visible junto a la casilla.
 * @property checked - Estado inicial (marcado/desmarcado).
 */
export interface ICheckbox {
    key: string;
    label: string;
    checked: boolean;
}

/**
 * Fila de {@link alternarMatriz}: una entrada con sus casillas asociadas.
 * El número de casillas puede variar entre filas (p.ej. una fila `i18n` con `enabled`/`watch`
 * junto a filas de workspace con solo `compilar`, solo `ejecutar`, o ambas).
 *
 * @property label      - Texto visible de la fila (nombre de la entrada).
 * @property checkboxes - Casillas de la fila, en el orden en que se muestran.
 */
export interface IFilaMatriz {
    label: string;
    checkboxes: ICheckbox[];
}

/**
 * Pulsación de tecla normalizada que emite `readline` en modo raw.
 */
interface ITecla {
    name: string;
    ctrl: boolean;
    sequence: string;
}

function atajo(tecla: string, desc: string): string {
    return `${Colors.colorize([Colors.FgWhite, Colors.Bright], tecla)} ${Colors.colorize([Colors.FgWhite, Colors.Dim], desc)}`;
}

function lineaAtajos(atajos: string[]): string {
    const sep = Colors.colorize([Colors.FgWhite, Colors.Dim], " │ ");
    return atajos.join(sep);
}

/**
 * Calcula el tamaño del viewport de la lista en función del alto actual del terminal.
 * Descuenta las líneas fijas (título, blancos, indicadores de scroll y ayuda).
 */
function calcularViewport(): number {
    // Líneas fijas cuando hay scroll:
    //   título(1) + blank(1) + ↑(1) + items(viewport) + ↓(1) + blank(1) + help(1) = viewport + 6
    // Para total ≤ rows-2 (evitar scroll por el \n final):
    //   viewport ≤ rows - 8
    return Math.max(3, (process.stdout.rows ?? 24) - 8);
}

/**
 * Ajusta `scroll` para que `cursor` quede siempre dentro del viewport visible.
 */
function sincronizarScroll(cursor: number, viewport: number, scroll: number): number {
    if (cursor < scroll) {
        return cursor;
    } else if (cursor >= scroll + viewport) {
        return cursor - viewport + 1;
    }
    return scroll;
}

/**
 * Gestiona el ciclo de vida TTY completo de un menú interactivo: activa el modo raw,
 * crea el `Render`, registra el listener de keypress y lo limpia todo al resolver.
 *
 * @param arrancar - Recibe `render` y `resolver`; dibuja el estado inicial y devuelve
 *   la función `onKeypress` a registrar.
 */
async function correrMenuTTY<T>(
    arrancar: (render: Render, resolver: (valor: T | null) => void) => (str: unknown, key: ITecla) => void,
): Promise<T | null> {
    prepararTTY();
    const render = new Render();
    const deferred = new Deferred<T | null>();
    let resuelto = false;
    const resolver = (valor: T | null): void => {
        if (resuelto) { return; }
        resuelto = true;
        process.stdin.removeListener("keypress", onKeypress);
        render.limpiar();
        restaurarTTY();
        deferred.resolve(valor);
    };
    const onKeypress = arrancar(render, resolver);
    process.stdin.on("keypress", onKeypress);

    return deferred.promise;
}

/**
 * Mueve el cursor según la tecla de navegación pulsada dentro de una lista de índices.
 * ↑/↓ envuelven cíclicamente; PgUp/PgDn saturan en los extremos.
 * Devuelve el cursor sin cambios si la tecla no es de navegación.
 *
 * @param keyName - `key.name` de la pulsación.
 * @param cursor  - Índice actual.
 * @param lista   - Array de índices navegables (p.ej. `seleccionables` o todos los índices).
 * @param viewport - Número de filas visibles (paso de PgUp/PgDn).
 */
function navegarCursor(keyName: string, cursor: number, lista: number[], viewport: number): number {
    const idx = lista.indexOf(cursor);
    if (idx === -1) { return cursor; }
    switch (keyName) {
        case "up":       return lista[(idx - 1 + lista.length) % lista.length];
        case "down":     return lista[(idx + 1) % lista.length];
        case "pageup":   return lista[Math.max(0, idx - viewport)];
        case "pagedown": return lista[Math.min(lista.length - 1, idx + viewport)];
        default:         return cursor;
    }
}

/**
 * Muestra un menú interactivo de selección simple y espera a que el usuario elija una opción.
 *
 * El usuario navega con ↑↓ / PgUp PgDn (saltando las opciones deshabilitadas), confirma
 * con Intro y cancela con Esc. Si la lista supera el alto del terminal se aplica scroll
 * automático con indicadores ↑/↓.
 *
 * @param titulo   - Título mostrado en la cabecera del menú.
 * @param opciones - Lista de opciones disponibles.
 * @param config   - Configuración opcional ({inicial}: índice de la opción preseleccionada).
 * @returns El valor de la opción seleccionada, o `null` si el usuario cancela.
 */
export async function seleccionar<T>(titulo: string, opciones: IMenuOpcion<T>[], {inicial = 0}: {inicial?: number} = {}): Promise<T | null> {
    const seleccionables = opciones.map((_, i) => i).filter(i => !opciones[i].disabled);
    if (seleccionables.length === 0) { return null; }

    let cursor = opciones[inicial]?.disabled === false ? inicial : seleccionables[0];
    const maxLabel = opciones.reduce((max, o) => Math.max(max, o.label.length), 0);
    let scroll = sincronizarScroll(cursor, calcularViewport(), 0);

    return correrMenuTTY<T>((render, resolver) => {
        const dibujar = (): void => {
            const viewport = calcularViewport();
            const necesitaScroll = opciones.length > viewport;
            const inicio = necesitaScroll ? scroll : 0;
            const fin    = necesitaScroll ? Math.min(opciones.length, inicio + viewport) : opciones.length;

            const lineas: string[] = [];
            lineas.push(Colors.colorize([Colors.FgCyan, Colors.Bright], titulo));
            lineas.push("");

            if (necesitaScroll) {
                lineas.push(inicio > 0
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más opciones arriba ···")
                    : "");
            }
            for (let i = inicio; i < fin; i++) {
                const opcion = opciones[i];
                const activo = i === cursor;
                const descripcion = opcion.descripcion
                    ? `  ${Colors.colorize([Colors.FgWhite, Colors.Dim], opcion.descripcion)}`
                    : "";
                if (opcion.disabled) {
                    lineas.push(`  ${Colors.colorize([Colors.FgWhite, Colors.Dim], opcion.label.padEnd(maxLabel))}${descripcion}`);
                } else if (activo) {
                    lineas.push(`${Colors.colorize([Colors.FgGreen, Colors.Bright], `► ${opcion.label.padEnd(maxLabel)}`)}${descripcion}`);
                } else {
                    lineas.push(`  ${Colors.colorize([Colors.FgWhite], opcion.label.padEnd(maxLabel))}${descripcion}`);
                }
            }
            if (necesitaScroll) {
                lineas.push(fin < opciones.length
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más opciones abajo ···")
                    : "");
            }
            lineas.push("");
            lineas.push(lineaAtajos([
                atajo("↑ ↓", "navegar"),
                ...(necesitaScroll ? [atajo("PgUp PgDn", "avanzar")] : []),
                atajo("Intro", "seleccionar"),
                atajo("Esc", "volver"),
            ]));
            render.dibujar(lineas);
        };

        dibujar();

        return (_str, key) => {
            if (key == null) { return; }
            if (key.name === "return") { resolver(opciones[cursor].value); return; }
            if (key.name === "escape" || key.name === "left" || (key.ctrl && key.name === "c")) { resolver(null); return; }
            const viewport = calcularViewport();
            const nuevo = navegarCursor(key.name, cursor, seleccionables, viewport);
            if (nuevo !== cursor) {
                cursor = nuevo;
                scroll = sincronizarScroll(cursor, viewport, scroll);
                dibujar();
            }
        };
    });
}

/**
 * Muestra un selector de radio: una lista de opciones con indicadores ◉/○ donde solo
 * una puede estar activa. El cursor navega con ↑↓ / PgUp PgDn y la selección sigue al
 * cursor. Confirma con Intro/Espacio y cancela con Esc. Si la lista supera el alto del
 * terminal se aplica scroll automático con indicadores ↑/↓.
 *
 * @param titulo   - Título mostrado en la cabecera.
 * @param opciones - Lista de opciones disponibles.
 * @param config   - Configuración opcional ({inicial}: índice de la opción preseleccionada).
 * @returns El valor de la opción seleccionada, o `null` si el usuario cancela.
 */
export async function elegirUno<T>(titulo: string, opciones: IMenuOpcion<T>[], {inicial = 0}: {inicial?: number} = {}): Promise<T | null> {
    const seleccionables = opciones.map((_, i) => i).filter(i => !opciones[i].disabled);
    if (seleccionables.length === 0) { return null; }

    let cursor = seleccionables.includes(inicial) ? inicial : seleccionables[0];
    const maxLabel = opciones.reduce((max, o) => Math.max(max, o.label.length), 0);
    let scroll = sincronizarScroll(cursor, calcularViewport(), 0);

    return correrMenuTTY<T>((render, resolver) => {
        const dibujar = (): void => {
            const viewport = calcularViewport();
            const necesitaScroll = opciones.length > viewport;
            const inicio = necesitaScroll ? scroll : 0;
            const fin    = necesitaScroll ? Math.min(opciones.length, inicio + viewport) : opciones.length;

            const lineas: string[] = [];
            lineas.push(Colors.colorize([Colors.FgCyan, Colors.Bright], titulo));
            lineas.push("");

            if (necesitaScroll) {
                lineas.push(inicio > 0
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más opciones arriba ···")
                    : "");
            }
            for (let i = inicio; i < fin; i++) {
                const opcion = opciones[i];
                const activo = i === cursor;
                const radio = activo
                    ? Colors.colorize([Colors.FgGreen, Colors.Bright], "◉")
                    : Colors.colorize([Colors.FgWhite, Colors.Dim], "○");
                const descripcion = opcion.descripcion
                    ? `  ${Colors.colorize([Colors.FgWhite, Colors.Dim], opcion.descripcion)}`
                    : "";
                if (opcion.disabled) {
                    lineas.push(`  ${Colors.colorize([Colors.FgWhite, Colors.Dim], `○ ${opcion.label.padEnd(maxLabel)}`)}${descripcion}`);
                } else if (activo) {
                    lineas.push(`  ${radio} ${Colors.colorize([Colors.FgGreen, Colors.Bright], opcion.label.padEnd(maxLabel))}${descripcion}`);
                } else {
                    lineas.push(`  ${radio} ${Colors.colorize([Colors.FgWhite], opcion.label.padEnd(maxLabel))}${descripcion}`);
                }
            }
            if (necesitaScroll) {
                lineas.push(fin < opciones.length
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más opciones abajo ···")
                    : "");
            }
            lineas.push("");
            lineas.push(lineaAtajos([
                atajo("↑ ↓", "navegar"),
                ...(necesitaScroll ? [atajo("PgUp PgDn", "avanzar")] : []),
                atajo("Intro", "guardar"),
                atajo("Esc", "cancelar"),
            ]));
            render.dibujar(lineas);
        };

        dibujar();

        return (_str, key) => {
            if (key == null) { return; }
            if (key.name === "return" || key.sequence === " " || key.name === "space") { resolver(opciones[cursor].value); return; }
            if (key.name === "escape" || key.name === "left" || (key.ctrl && key.name === "c")) { resolver(null); return; }
            const viewport = calcularViewport();
            const nuevo = navegarCursor(key.name, cursor, seleccionables, viewport);
            if (nuevo !== cursor) {
                cursor = nuevo;
                scroll = sincronizarScroll(cursor, viewport, scroll);
                dibujar();
            }
        };
    });
}

/**
 * Muestra una matriz de filas con casillas independientes por fila y espera la confirmación
 * del usuario. El usuario navega entre filas con ↑↓ / PgUp PgDn, entre las casillas de la
 * fila activa con ← →, alterna la casilla bajo el cursor con Espacio, marca/desmarca todas
 * las casillas de todas las filas con `a`/`n`, confirma con Intro y cancela con Esc.
 * Si la lista supera el alto del terminal se aplica scroll automático con indicadores ↑/↓.
 *
 * @param titulo - Título mostrado en la cabecera de la matriz.
 * @param filas  - Filas con sus casillas y estado inicial.
 * @returns Por cada fila, un objeto `{clave: estado}` con el nuevo estado de sus casillas
 *   (mismo orden que `filas`), o `null` si el usuario cancela.
 */
export async function alternarMatriz(titulo: string, filas: IFilaMatriz[]): Promise<Record<string, boolean>[] | null> {
    if (filas.length === 0) { return null; }

    const estado = filas.map(fila => fila.checkboxes.map(cb => cb.checked));
    const todasFilas = filas.map((_, i) => i);
    const maxLabel = filas.reduce((max, f) => Math.max(max, f.label.length), 0);
    const anchoColumnas: number[] = [];
    for (const fila of filas) {
        fila.checkboxes.forEach((cb, j) => {
            anchoColumnas[j] = Math.max(anchoColumnas[j] ?? 0, cb.label.length);
        });
    }
    let filaCursor = 0;
    let colCursor = 0;
    let scroll = 0;

    return correrMenuTTY<Record<string, boolean>[]>((render, resolver) => {
        const dibujar = (): void => {
            const viewport = calcularViewport();
            const necesitaScroll = filas.length > viewport;
            const inicio = necesitaScroll ? scroll : 0;
            const fin    = necesitaScroll ? Math.min(filas.length, inicio + viewport) : filas.length;

            const lineas: string[] = [];
            lineas.push(Colors.colorize([Colors.FgCyan, Colors.Bright], titulo));
            lineas.push("");

            if (necesitaScroll) {
                lineas.push(inicio > 0
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más elementos arriba ···")
                    : "");
            }
            for (let i = inicio; i < fin; i++) {
                const fila = filas[i];
                const filaActiva = i === filaCursor;
                const indicador = filaActiva
                    ? Colors.colorize([Colors.FgGreen, Colors.Bright], "►")
                    : " ";
                const etiqueta = filaActiva
                    ? Colors.colorize([Colors.FgWhite, Colors.Bright], fila.label.padEnd(maxLabel))
                    : Colors.colorize([Colors.FgWhite], fila.label.padEnd(maxLabel));
                const celdas = fila.checkboxes.map((cb, j) => {
                    const marcado = estado[i][j];
                    const activo = filaActiva && j === colCursor;
                    const casilla = marcado
                        ? Colors.colorize([Colors.FgGreen, Colors.Bright], "[x]")
                        : Colors.colorize([Colors.FgWhite, Colors.Dim], "[ ]");
                    const etiquetaCasilla = cb.label.padEnd(anchoColumnas[j]);
                    const texto = activo
                        ? Colors.colorize([Colors.FgGreen, Colors.Bright], etiquetaCasilla)
                        : Colors.colorize(marcado ? [Colors.FgWhite] : [Colors.FgWhite, Colors.Dim], etiquetaCasilla);
                    return `${casilla} ${texto}`;
                }).join("   ");
                lineas.push(`${indicador} ${etiqueta}  ${celdas}`);
            }
            if (necesitaScroll) {
                lineas.push(fin < filas.length
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más elementos abajo ···")
                    : "");
            }
            lineas.push("");
            lineas.push(lineaAtajos([
                atajo("↑ ↓", "fila"),
                atajo("← →", "campo"),
                ...(necesitaScroll ? [atajo("PgUp PgDn", "avanzar")] : []),
                atajo("Espacio", "alternar"),
                atajo("a", "todos"),
                atajo("n", "ninguno"),
                atajo("Intro", "guardar"),
                atajo("Esc", "cancelar"),
            ]));
            render.dibujar(lineas);
        };

        dibujar();

        return (_str, key) => {
            if (key == null) { return; }
            if (key.name === "return") {
                resolver(filas.map((fila, i) => Object.fromEntries(fila.checkboxes.map((cb, j) => [cb.key, estado[i][j]]))));
                return;
            }
            if (key.name === "escape" || (key.ctrl && key.name === "c")) { resolver(null); return; }
            if (key.sequence === " " || key.name === "space") { estado[filaCursor][colCursor] = !estado[filaCursor][colCursor]; dibujar(); return; }
            if (key.name === "a") { for (const fila of estado) { fila.fill(true); } dibujar(); return; }
            if (key.name === "n") { for (const fila of estado) { fila.fill(false); } dibujar(); return; }
            if (key.name === "left") { colCursor = Math.max(0, colCursor - 1); dibujar(); return; }
            if (key.name === "right") { colCursor = Math.min(filas[filaCursor].checkboxes.length - 1, colCursor + 1); dibujar(); return; }
            const viewport = calcularViewport();
            const nuevaFila = navegarCursor(key.name, filaCursor, todasFilas, viewport);
            if (nuevaFila !== filaCursor) {
                filaCursor = nuevaFila;
                colCursor = Math.min(colCursor, filas[filaCursor].checkboxes.length - 1);
                scroll = sincronizarScroll(filaCursor, viewport, scroll);
                dibujar();
            }
        };
    });
}
