/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 26 Jun 2026 10:04:43 GMT
 * Hash: 9c11731e1971b758ef611b223fef553d
 * Versión: 2026.6.26+1-josantoniojimnez
 * Anterior: 2026.6.25+10-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
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
 * Elemento de una lista de alternancia (checkbox múltiple).
 *
 * @property label   - Texto visible del elemento.
 * @property checked - Estado inicial (marcado/desmarcado).
 */
export interface IToggleItem {
    label: string;
    checked: boolean;
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
 * Muestra una lista de elementos alternables (checkbox múltiple) y espera la confirmación
 * del usuario. El usuario navega con ↑↓ / PgUp PgDn, alterna el elemento bajo el cursor
 * con Espacio, marca/desmarca todos con `a`/`n`, confirma con Intro y cancela con Esc.
 * Si la lista supera el alto del terminal se aplica scroll automático con indicadores ↑/↓.
 *
 * @param titulo - Título mostrado en la cabecera de la lista.
 * @param items  - Elementos con su estado inicial.
 * @returns Array con el nuevo estado de cada elemento, o `null` si el usuario cancela.
 */
export async function alternarLista(titulo: string, items: IToggleItem[]): Promise<boolean[] | null> {
    if (items.length === 0) { return null; }

    const estado = items.map(item => item.checked);
    const todosIndices = items.map((_, i) => i);
    let cursor = 0;
    let scroll = 0;

    return correrMenuTTY<boolean[]>((render, resolver) => {
        const dibujar = (): void => {
            const viewport = calcularViewport();
            const necesitaScroll = items.length > viewport;
            const inicio = necesitaScroll ? scroll : 0;
            const fin    = necesitaScroll ? Math.min(items.length, inicio + viewport) : items.length;

            const lineas: string[] = [];
            lineas.push(Colors.colorize([Colors.FgCyan, Colors.Bright], titulo));
            lineas.push("");

            if (necesitaScroll) {
                lineas.push(inicio > 0
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más elementos arriba ···")
                    : "");
            }
            for (let i = inicio; i < fin; i++) {
                const activo = i === cursor;
                const marcado = estado[i];
                const casilla = marcado
                    ? Colors.colorize([Colors.FgGreen, Colors.Bright], "[x]")
                    : Colors.colorize([Colors.FgWhite, Colors.Dim], "[ ]");
                const indicador = activo
                    ? Colors.colorize([Colors.FgGreen, Colors.Bright], "►")
                    : " ";
                const etiqueta = activo
                    ? Colors.colorize([Colors.FgWhite, Colors.Bright], items[i].label)
                    : Colors.colorize(marcado ? [Colors.FgWhite] : [Colors.FgWhite, Colors.Dim], items[i].label);
                lineas.push(`${indicador} ${casilla} ${etiqueta}`);
            }
            if (necesitaScroll) {
                lineas.push(fin < items.length
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más elementos abajo ···")
                    : "");
            }
            lineas.push("");
            lineas.push(lineaAtajos([
                atajo("↑ ↓", "navegar"),
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
            if (key.name === "return") { resolver([...estado]); return; }
            if (key.name === "escape" || key.name === "left" || (key.ctrl && key.name === "c")) { resolver(null); return; }
            if (key.sequence === " " || key.name === "space") { estado[cursor] = !estado[cursor]; dibujar(); return; }
            if (key.name === "a") { estado.fill(true);  dibujar(); return; }
            if (key.name === "n") { estado.fill(false); dibujar(); return; }
            const viewport = calcularViewport();
            const nuevo = navegarCursor(key.name, cursor, todosIndices, viewport);
            if (nuevo !== cursor) {
                cursor = nuevo;
                scroll = sincronizarScroll(cursor, viewport, scroll);
                dibujar();
            }
        };
    });
}
