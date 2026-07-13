/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 30 Jun 2026 10:13:56 GMT
 * Hash: 464e194351a2b9c532394b964ef539a9
 * Versión: 2026.6.30+2-josantoniojimnez
 * Anterior: 2026.6.26+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import readline from "node:readline";

import {maquetarVersion, parsearFechaVersion} from "../../../utiles/version";
import {interceptarSalida} from "../../../utiles/output-capture";
import {anchoVisible, Render} from "../../../utiles/tty";
import {Colors} from "../../colors";
import {EstadoArchivo, OrigenArchivo, type IArchivoCambiado} from "../../paquete";
import {FrameworkUpdates} from "../../workspace/service";
import {Accion, type IPaqueteGestion} from "./datos";
import {calcularDiff, calcularDiffSideBySide, esDiffable, panelMagenta} from "./diff-render";

/**
 * Modo de operación de `GestorTabla`.
 *
 * - `"todos"`  — tabla completa con todas las acciones disponibles.
 * - `"update"` — solo columnas "nada" y "actualizar".
 * - `"reset"`  — solo columnas "nada" y "resetear".
 * - `"send"`   — solo columnas "nada" y "enviar/actualizar+enviar".
 */
export type GestorModo = "todos" | "update" | "reset" | "send";

/**
 * Configuración del constructor de {@link GestorTabla}.
 *
 * @property modo             - Subconjunto de acciones a mostrar. Por defecto `"todos"`.
 * @property frameworkUpdates - Política de auto-preselección en modo `"update"`. Por defecto `all`.
 * @property defaultAcciones  - Acciones iniciales por índice. Si se omite se calculan automáticamente.
 */
interface IGestorTablaConfig {
    modo?: GestorModo;
    frameworkUpdates?: FrameworkUpdates;
    defaultAcciones?: Accion[];
}

/**
 * Configuración de {@link GestorTabla.run}.
 *
 * @property autoConfirmMs - Si se especifica, la tabla se auto-confirma trascurridos
 *   estos milisegundos mostrando una cuenta atrás. Cualquier pulsación cancela el timer.
 */
interface IGestorTablaRunConfig {
    autoConfirmMs?: number;
}

/**
 * Tabla interactiva de gestión de paquetes.
 *
 * Muestra todos los paquetes en una tabla con columnas (tipo, nombre, instalada,
 * disponible, acción). El usuario navega con ↑↓ entre filas, cambia la acción
 * con ←→. Intro confirma todos los cambios a la vez.
 */
export class GestorTabla {
    /* INSTANCE */
    private readonly infos: IPaqueteGestion[];
    private readonly acciones: Accion[];
    private fila: number;
    private readonly maxTipo: number;
    private readonly maxNombre: number;
    private readonly hayActualizar: boolean;
    private readonly hayEnviar: boolean;
    private readonly hayEnviarConUpdate: boolean;
    private readonly anchoEnviar: number;
    private _dibujando: boolean;
    private _procesandoTecla: boolean;
    private _vista: "tabla" | "lista" | "diff";
    private _listaCambios: IArchivoCambiado[];
    private _listaFila: number;
    private _listaInfo: IPaqueteGestion | null;
    private _diffLineas: string[];
    private _diffScroll: number;
    private _diffArchivo: string;
    private _diffAutor: string;
    private _listaModo: "enviar" | "actualizar" | "ambos";
    private _listaLatest: string;
    private _listaScroll: number;
    private _tablaScroll: number;
    private readonly modo: GestorModo;
    private segundosRestantes: number | undefined;
    private readonly slots: {key: Accion; ancho: number}[];
    private readonly frameworkUpdates: FrameworkUpdates;
    private readonly render: Render;

    public constructor(infos: IPaqueteGestion[], config: IGestorTablaConfig = {}) {
        const {modo = "todos", frameworkUpdates = FrameworkUpdates.all, defaultAcciones} = config;
        this.infos = infos;
        this.modo = modo;
        this.frameworkUpdates = frameworkUpdates;
        this.segundosRestantes = undefined;
        this.acciones = defaultAcciones
            ? [...defaultAcciones]
            : infos.map(info => this.defaultAccion(info));
        this.fila = 0;
        this.maxTipo           = Math.max("tipo".length,   infos.reduce((m, i) => Math.max(m, i.tipo.length),   0));
        this.maxNombre         = Math.max("nombre".length, infos.reduce((m, i) => Math.max(m, i.nombre.length), 0));
        this.hayActualizar      = infos.some(i => i.instalado && i.tieneUpdate);
        this.hayEnviarConUpdate = (modo === "todos" || modo === "send") ? infos.some(i => GestorTabla.tieneEnviarConUpdate(i)) : false;
        this.hayEnviar          = (modo === "todos" || modo === "send") ? (this.hayEnviarConUpdate || infos.some(i => GestorTabla.tieneEnviar(i))) : false;
        this.anchoEnviar        = this.hayEnviarConUpdate ? "actualizar+enviar".length : "enviar".length;
        this._dibujando         = false;
        this._procesandoTecla   = false;
        this._vista             = "tabla";
        this._listaCambios      = [];
        this._listaFila         = 0;
        this._listaInfo         = null;
        this._diffLineas        = [];
        this._diffScroll        = 0;
        this._diffArchivo       = "";
        this._diffAutor         = "";
        this._listaModo         = "enviar";
        this._listaLatest       = "";
        this._listaScroll       = 0;
        this._tablaScroll       = 0;
        this.render             = new Render();

        this.slots = (() => {
            switch (modo) {
                case "update":
                    return [
                        {key: Accion.Nada,      ancho: "nada".length},
                        ...(this.hayActualizar ? [{key: Accion.Actualizar, ancho: "actualizar".length}] : []),
                    ];
                case "reset":
                    return [
                        {key: Accion.Nada,     ancho: "nada".length},
                        {key: Accion.Resetear, ancho: "resetear".length},
                    ];
                case "send":
                    return [
                        {key: Accion.Nada,   ancho: "nada".length},
                        ...(this.hayEnviar ? [{key: Accion.Enviar, ancho: this.anchoEnviar}] : []),
                    ];
                case "todos":
                default:
                    return [
                        {key: Accion.Nada,        ancho: "nada".length},
                        ...(this.hayActualizar ? [{key: Accion.Actualizar, ancho: "actualizar".length}] : []),
                        {key: Accion.Desinstalar, ancho: "desinstalar".length},
                        {key: Accion.Resetear,    ancho: "resetear".length},
                        ...(this.hayEnviar ? [{key: Accion.Enviar, ancho: this.anchoEnviar}] : []),
                    ];
            }
        })();
    }

    /** Ancho total de la columna de acciones, calculado a partir de los slots activos. */
    private get anchoAcciones(): number {
        return this.slots.reduce((acc, s, i) => acc + (i > 0 ? 2 : 0) + 2 + s.ancho, 0);
    }

    /**
     * `true` si el paquete puede enviarse directamente: instalado, subible, sin update pendiente y con cambios locales.
     *
     * @param info - Estado del paquete a evaluar.
     * @returns `true` si el paquete puede enviarse sin actualización previa.
     */
    public static tieneEnviar(info: IPaqueteGestion): boolean {
        return info.instalado && !info.tieneUpdate && info.paquete.esSubible && info.tieneCambiosLocales;
    }

    /**
     * `true` si el paquete tiene update pendiente Y cambios locales: puede hacer actualizar+enviar en dos pasos.
     *
     * @param info - Estado del paquete a evaluar.
     * @returns `true` si el paquete requiere actualización previa antes de enviarse.
     */
    public static tieneEnviarConUpdate(info: IPaqueteGestion): boolean {
        return info.instalado && info.tieneUpdate && info.paquete.esSubible && info.tieneCambiosLocales;
    }

    private defaultAccion(info: IPaqueteGestion): Accion {
        switch (this.modo) {
            case "reset":
                return info.instalado ? Accion.Resetear : Accion.Nada;
            case "send":
                if (GestorTabla.tieneEnviarConUpdate(info)) { return Accion.EnviarConUpdate; }
                if (GestorTabla.tieneEnviar(info)) { return Accion.Enviar; }
                return Accion.Nada;
            case "todos":
                return Accion.Nada;
            case "update":
            default:
                if (!info.instalado || !info.tieneUpdate) { return Accion.Nada; }
                return this.debeActualizar(info) ? Accion.Actualizar : Accion.Nada;
        }
    }

    /**
     * Determina si el paquete debe preseleccionarse en `actualizar` según la
     * política `frameworkUpdates`:
     *
     * - `all`    — siempre `true`.
     * - `daily`  — `true` solo si la versión local lleva publicada 1 día o más.
     * - `weekly` — igual pero con umbral de 7 días.
     */
    private debeActualizar(info: IPaqueteGestion): boolean {
        if (this.frameworkUpdates === FrameworkUpdates.all) {
            return true;
        }

        const threshold = this.frameworkUpdates === FrameworkUpdates.daily
            ? 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;

        const localVersion = info.versionLocal;
        if (localVersion === undefined) {
            return true;
        }

        // TODO: reactivar cuando el historial de stable.txt esté desplegado en todos los paquetes
        // if (!info.versionesRemota.includes(localVersion)) { return true; }

        return Date.now() - parsearFechaVersion(localVersion).getTime() >= threshold;
    }

    private accionesDisponibles(info: IPaqueteGestion): Accion[] {
        switch (this.modo) {
            case "update": {
                const lista: Accion[] = [Accion.Nada];
                if (info.instalado && info.tieneUpdate) { lista.push(Accion.Actualizar); }
                return lista;
            }
            case "reset": {
                const lista: Accion[] = [Accion.Nada];
                if (info.instalado) { lista.push(Accion.Resetear); }
                return lista;
            }
            case "send": {
                const lista: Accion[] = [Accion.Nada];
                if (GestorTabla.tieneEnviar(info)) { lista.push(Accion.Enviar); }
                if (GestorTabla.tieneEnviarConUpdate(info)) { lista.push(Accion.EnviarConUpdate); }
                return lista;
            }
            case "todos":
            default: {
                const lista: Accion[] = [Accion.Nada];
                if (!info.instalado && info.versionLatest !== undefined) {
                    lista.push(Accion.Instalar);
                }
                if (info.instalado && info.tieneUpdate) {
                    lista.push(Accion.Actualizar);
                }
                if (info.instalado) {
                    if (!info.esCli && !info.esLegacy) { lista.push(Accion.Desinstalar); }
                    lista.push(Accion.Resetear);
                }
                if (GestorTabla.tieneEnviar(info)) { lista.push(Accion.Enviar); }
                if (GestorTabla.tieneEnviarConUpdate(info)) { lista.push(Accion.EnviarConUpdate); }
                return lista;
            }
        }
    }

    private ciclarAccion(dir: 1 | -1): void {
        const info = this.infos[this.fila];
        const disponibles = this.accionesDisponibles(info);
        const i = disponibles.indexOf(this.acciones[this.fila]);
        this.acciones[this.fila] = disponibles[(i + dir + disponibles.length) % disponibles.length];
    }

    private aplicarATodos(accion: Accion): void {
        for (let i = 0; i < this.infos.length; i++) {
            if (this.accionesDisponibles(this.infos[i]).includes(accion)) {
                this.acciones[i] = accion;
            }
        }
    }

    private etiquetaAccion(_info: IPaqueteGestion, accion: Accion): string {
        switch (accion) {
            case Accion.Nada:            return "nada";
            case Accion.Instalar:        return "instalar";
            case Accion.Actualizar:      return "actualizar";
            case Accion.Resetear:        return "resetear";
            case Accion.Desinstalar:     return "desinstalar";
            case Accion.Enviar:          return "enviar";
            case Accion.EnviarConUpdate: return "actualizar+enviar";
        }
    }

    private renderAcciones(info: IPaqueteGestion, accion: Accion, activo: boolean): string {
        const disponibles = this.accionesDisponibles(info);

        return this.slots.map(({key, ancho}) => {
            if (key === Accion.Enviar) {
                const hayEnviar          = disponibles.includes(Accion.Enviar);
                const hayEnviarConUpdate = disponibles.includes(Accion.EnviarConUpdate);

                if (!hayEnviar && !hayEnviarConUpdate) {
                    return " ".repeat(2 + ancho);
                }

                const accionEfectiva = hayEnviarConUpdate ? Accion.EnviarConUpdate : Accion.Enviar;
                const etiqueta       = this.etiquetaAccion(info, accionEfectiva).padEnd(ancho);
                const seleccionada   = accion === accionEfectiva;
                const radio          = seleccionada ? "◉" : "○";

                if (hayEnviarConUpdate) {
                    if (seleccionada) {
                        return Colors.colorize(activo ? [Colors.FgCyan, Colors.Bright] : [Colors.FgCyan], `${radio} ${etiqueta}`);
                    }
                    return Colors.colorize(activo ? [Colors.FgCyan] : [Colors.FgCyan, Colors.Dim], `${radio} ${etiqueta}`);
                } else {
                    if (seleccionada) {
                        return Colors.colorize(activo ? [Colors.FgGreen, Colors.Bright] : [Colors.FgGreen], `${radio} ${etiqueta}`);
                    }
                    return Colors.colorize(activo ? [Colors.FgGreen] : [Colors.FgGreen, Colors.Dim], `${radio} ${etiqueta}`);
                }
            }

            if (key === Accion.Desinstalar) {
                const hayInstalar    = disponibles.includes(Accion.Instalar);
                const hayDesinstalar = disponibles.includes(Accion.Desinstalar);

                if (!hayInstalar && !hayDesinstalar) {
                    return " ".repeat(2 + ancho);
                }

                const accionEfectiva = hayInstalar ? Accion.Instalar : Accion.Desinstalar;
                const etiqueta       = this.etiquetaAccion(info, accionEfectiva).padEnd(ancho);
                const seleccionada   = accion === accionEfectiva;
                const radio          = seleccionada ? "◉" : "○";
                if (activo && seleccionada) {
                    return Colors.colorize([Colors.FgYellow, Colors.Bright], `${radio} ${etiqueta}`);
                } else if (seleccionada) {
                    return Colors.colorize([Colors.FgWhite, Colors.Bright], `${radio} ${etiqueta}`);
                } else {
                    return Colors.colorize([Colors.FgWhite, Colors.Dim], `${radio} ${etiqueta}`);
                }
            }

            const disponible   = disponibles.includes(key);
            if (!disponible) {
                return " ".repeat(2 + ancho);
            }
            const etiqueta     = this.etiquetaAccion(info, key).padEnd(ancho);
            const seleccionada = accion === key;
            const radio        = seleccionada ? "◉" : "○";
            if (activo && seleccionada) {
                return Colors.colorize([Colors.FgYellow, Colors.Bright], `${radio} ${etiqueta}`);
            } else if (seleccionada) {
                return Colors.colorize([Colors.FgWhite, Colors.Bright], `${radio} ${etiqueta}`);
            } else {
                return Colors.colorize([Colors.FgWhite, Colors.Dim], `${radio} ${etiqueta}`);
            }
        }).join("  ");
    }

    private renderFila(i: number): string {
        const info   = this.infos[i];
        const accion = this.acciones[i];
        const activo = i === this.fila;
        const SEP    = Colors.colorize([Colors.Dim], "│");

        const indicator = activo
            ? Colors.colorize([Colors.FgCyan, Colors.Bright], "►")
            : " ";
        const tipoStr   = Colors.colorize(
            activo ? [Colors.FgCyan, Colors.Bright]    : [Colors.FgCyan],
            info.tipo.padEnd(this.maxTipo),
        );
        const nombreStr = Colors.colorize(
            activo ? [Colors.FgMagenta, Colors.Bright] : [Colors.FgMagenta],
            info.nombre.padEnd(this.maxNombre),
        );
        const localStr  = info.versionLocal
            ? Colors.colorize(activo ? [Colors.FgBlue, Colors.Bright] : [Colors.FgBlue], maquetarVersion(info.versionLocal))
            : Colors.colorize([Colors.FgYellow, Colors.Dim], "no instalado ");
        const remotoStr = info.versionLatest
            ? Colors.colorize(activo ? [Colors.FgGreen, Colors.Bright] : [Colors.FgGreen], maquetarVersion(info.versionLatest))
            : Colors.colorize([Colors.FgWhite, Colors.Dim], "desconocido  ");
        const accionStr = this.renderAcciones(info, accion, activo);

        return `${indicator} ${tipoStr} ${SEP} ${nombreStr} ${SEP} ${localStr} ${SEP} ${remotoStr} ${SEP} ${accionStr}`;
    }

    private renderCabecera(): string {
        const SEP = Colors.colorize([Colors.Dim], "│");
        return [
            Colors.colorize([Colors.FgWhite, Colors.Bright], `  ${"tipo".padEnd(this.maxTipo)}`),
            Colors.colorize([Colors.FgWhite, Colors.Bright], "nombre".padEnd(this.maxNombre)),
            Colors.colorize([Colors.FgWhite, Colors.Bright], "instalada    "),
            Colors.colorize([Colors.FgWhite, Colors.Bright], "disponible   "),
            Colors.colorize([Colors.FgWhite, Colors.Bright], "acción"),
        ].join(` ${SEP} `);
    }

    /** Ajusta `_tablaScroll` para que `fila` quede siempre dentro del viewport visible. */
    private sincronizarScrollTabla(): void {
        const viewport = Math.max(3, (process.stdout.rows ?? 24) - 10);
        if (this.fila < this._tablaScroll) {
            this._tablaScroll = this.fila;
        } else if (this.fila >= this._tablaScroll + viewport) {
            this._tablaScroll = this.fila - viewport + 1;
        }
    }

    private dibujar(): void {
        // Ancho visible de cada fila de datos:
        // 2 (indicador+espacio) + maxTipo + 3 (" │ ") + maxNombre + 3 + 13 (versión) + 3 + 13 + 3 + anchoAcciones
        const anchoContenido = 40 + this.maxTipo + this.maxNombre + this.anchoAcciones;

        // Helpers de borde en cyan (distinto del panel de cambios en magenta).
        const BOR = (s: string) => Colors.colorize([Colors.FgCyan], s);
        const borH  = "─".repeat(anchoContenido);
        const top   = BOR(`┌${borH}┐`);
        const mid   = BOR(`├${borH}┤`);
        const bot   = BOR(`└${borH}┘`);

        // Añade borde izquierdo y derecho a una línea ya coloreada,
        // rellenando con espacios hasta el ancho correcto.
        const bordeado = (line: string): string => {
            const visible = anchoVisible(line);
            const padding = " ".repeat(Math.max(0, anchoContenido - visible));
            return `${BOR("│")}${line}${padding}${BOR("│")}`;
        };
        const bordeadoVacio = (): string => bordeado(" ".repeat(anchoContenido));
        const indicadorScroll = (texto: string): string => {
            const visible = anchoVisible(texto);
            const padding = " ".repeat(Math.max(0, anchoContenido - visible));
            return `${BOR("│")}${texto}${padding}${BOR("│")}`;
        };

        // Viewport: filas disponibles menos los elementos fijos.
        // top+header+mid + ↑+↓ + bot+help = 7. Con countdown = 8. Usamos -10 para garantizar
        // que lineas.length ≤ rows-2 incluso con la línea de countdown, evitando que el \n
        // final cause scroll en el terminal en cada redibujado.
        const viewport      = Math.max(3, (process.stdout.rows ?? 24) - 10);
        const necesitaScroll = this.infos.length > viewport;
        const inicio        = necesitaScroll ? this._tablaScroll : 0;
        const infosVis      = necesitaScroll ? this.infos.slice(inicio, inicio + viewport) : this.infos;

        const lineas: string[] = [];
        lineas.push(top);
        lineas.push(bordeado(this.renderCabecera()));
        lineas.push(mid);

        // Indicador superior fijo cuando hay scroll
        if (necesitaScroll) {
            lineas.push(indicadorScroll(
                inicio > 0
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más elementos arriba ···")
                    : "",
            ));
        }

        for (let i = 0; i < infosVis.length; i++) {
            lineas.push(bordeado(this.renderFila(inicio + i)));
        }
        // Rellenar huecos al final para mantener altura constante
        if (necesitaScroll) {
            for (let i = infosVis.length; i < viewport; i++) {
                lineas.push(bordeadoVacio());
            }
        }

        // Indicador inferior fijo cuando hay scroll
        if (necesitaScroll) {
            lineas.push(indicadorScroll(
                inicio + viewport < this.infos.length
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más elementos abajo ···")
                    : "",
            ));
        }

        lineas.push(bot);

        // Los atajos van fuera del recuadro para evitar problemas de ancho variable.
        const SEP_AYUDA = Colors.colorize([Colors.FgWhite, Colors.Dim], "│");
        const atajo = (tecla: string, desc: string) =>
            `${Colors.colorize([Colors.FgWhite, Colors.Bright], tecla)}  ${Colors.colorize([Colors.FgWhite, Colors.Dim], desc)}`;
        const atajos = [
            atajo("↑ ↓", "navegar"),
            atajo("← →", "cambiar acción"),
            atajo("Intro", "aplicar"),
            atajo("Esc", "cancelar"),
            atajo("n", "nada todos"),
        ];
        if (this.modo === "todos" || this.modo === "update") {
            atajos.push(atajo("a", "actualizar todos"));
        }
        if (this.modo === "todos" || this.modo === "reset") {
            atajos.push(atajo("r", "resetear todos"));
        }
        if ((this.modo === "todos" || this.modo === "send") && this.hayEnviar) {
            atajos.push(atajo("e", "enviar todos"));
        }
        if ((this.modo === "todos" || this.modo === "update" || this.modo === "send") &&
                (this.hayEnviar || this.hayActualizar)) {
            atajos.push(atajo("d", "ver cambios"));
        }
        lineas.push(atajos.join(`  ${SEP_AYUDA}  `));

        if (this.segundosRestantes !== undefined) {
            lineas.push(Colors.colorize([Colors.FgYellow, Colors.Dim],
                `  Auto-confirma en ${this.segundosRestantes}s — pulsa cualquier tecla para cancelar`));
        }

        this._dibujarLineas(lineas);
    }

    // ── Vista: lista de ficheros cambiados ────────────────────────────────────────

    private sincronizarScrollLista(): void {
        const viewport = Math.max(3, (process.stdout.rows ?? 24) - 11);
        if (this._listaFila < this._listaScroll) {
            this._listaScroll = this._listaFila;
        } else if (this._listaFila >= this._listaScroll + viewport) {
            this._listaScroll = this._listaFila - viewport + 1;
        }
    }

    /** Mueve el cursor una o varias posiciones arriba o abajo, pasando por todos los items. */
    private navegarLista(dir: 1 | -1, {paso = 1}: {paso?: number} = {}): void {
        const n = this._listaCambios.length;
        if (n === 0) { return; }
        const nueva = Math.max(0, Math.min(n - 1, this._listaFila + dir * paso));
        if (nueva !== this._listaFila) {
            this._listaFila = nueva;
            this.sincronizarScrollLista();
            this.dibujarLista();
        }
    }

    /** Dibuja el panel de lista de ficheros con el cursor de selección activo. */
    private dibujarLista(): void {
        const info     = this._listaInfo!;
        const archivos = this._listaCambios;
        const titulo   = this._listaModo === "ambos"
            ? `Cambios locales y remotos — ${info.npmName} (→ ${this._listaLatest})`
            : this._listaModo === "actualizar"
            ? `Cambios del update — ${info.npmName} (→ ${this._listaLatest})`
            : `Cambios locales — ${info.npmName}`;
        // En modo "ambos" cada línea lleva un prefijo extra "[L] " de 4 chars
        const extraOrigen = this._listaModo === "ambos" ? 4 : 0;
        const maxLen   = archivos.reduce((m, f) => Math.max(m, f.archivo.length + 9 + extraOrigen), titulo.length);
        const innerWidth = Math.max(maxLen, 40) + 4;
        const {top, mid, bot, fila, filaColoreada} = panelMagenta(innerWidth);

        // Viewport: filas disponibles menos los elementos fijos del panel.
        // top+titulo+mid + ↑+↓ + mid+count+bot+help = 9. Usamos -11 para garantizar
        // total ≤ rows-2 y evitar que el \n final provoque scroll en el terminal.
        const viewport      = Math.max(3, (process.stdout.rows ?? 24) - 11);
        const necesitaScroll = archivos.length > viewport;
        const inicio        = necesitaScroll ? this._listaScroll : 0;
        const archivosVis   = necesitaScroll ? archivos.slice(inicio, inicio + viewport) : archivos;

        const lineas: string[] = [];
        lineas.push(top);
        lineas.push(fila(titulo, s => Colors.colorize([Colors.FgMagenta, Colors.Bright], s)));
        lineas.push(mid);

        if (archivos.length === 0) {
            lineas.push(fila("(sin cambios detectados)", s => Colors.colorize([Colors.FgYellow], s)));
        } else {
            // Indicador superior (slot fijo para mantener altura constante)
            if (necesitaScroll) {
                lineas.push(filaColoreada(
                    inicio > 0
                        ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más elementos arriba ···")
                        : "",
                ));
            }

            for (let i = 0; i < archivosVis.length; i++) {
                const idx    = inicio + i;
                const item   = archivosVis[i];
                const activo = idx === this._listaFila;
                const diffable = esDiffable(item);

                // Prefijo de origen — solo en modo "ambos"
                let origenPrefix = "";
                if (this._listaModo === "ambos") {
                    const [origenText, origenCodes] = item.origen === OrigenArchivo.Ambos
                        ? ["[X]", [Colors.FgMagenta, Colors.Bright]]
                        : item.origen === OrigenArchivo.Local
                        ? ["[L]", [Colors.FgBlue,    Colors.Bright]]
                        : ["[R]", [Colors.FgBlue,    Colors.Bright]];
                    origenPrefix = `${Colors.colorize(origenCodes, origenText)} `;
                }

                // Etiqueta de estado [C]/[N]/[D]/[!]
                const labelText  = item.conflicto                              ? "[!]" :
                    item.estado === EstadoArchivo.Nuevo     ? "[N]" :
                    item.estado === EstadoArchivo.Eliminado ? "[D]" : "[C]";
                const labelCodes = item.conflicto                              ? [Colors.FgMagenta, Colors.Bright] :
                    item.estado === EstadoArchivo.Nuevo     ? [Colors.FgGreen,   Colors.Bright] :
                    item.estado === EstadoArchivo.Eliminado ? [Colors.FgRed,     Colors.Bright] :
                    [Colors.FgCyan, Colors.Bright];
                const label = Colors.colorize(labelCodes, labelText);

                if (diffable) {
                    const indicador = activo
                        ? Colors.colorize([Colors.FgGreen, Colors.Bright], "►")
                        : " ";
                    const nombre = Colors.colorize(
                        activo ? [Colors.FgGreen, Colors.Bright] : [Colors.FgGreen],
                        `● ${item.archivo}`,
                    );
                    lineas.push(filaColoreada(` ${origenPrefix}${label} ${indicador} ${nombre}`));
                } else {
                    const indicador = activo ? Colors.colorize([Colors.Dim], "►") : " ";
                    const nombre = Colors.colorize([Colors.Dim], `○ ${item.archivo}`);
                    lineas.push(filaColoreada(` ${origenPrefix}${label} ${indicador} ${nombre}`));
                }
            }
            // Rellenar huecos sobrantes para mantener altura constante al hacer scroll
            if (necesitaScroll) {
                for (let i = archivosVis.length; i < viewport; i++) {
                    lineas.push(filaColoreada(""));
                }
            }

            // Indicador inferior (slot fijo)
            if (necesitaScroll) {
                lineas.push(filaColoreada(
                    inicio + viewport < archivos.length
                        ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más elementos abajo ···")
                        : "",
                ));
            }

            lineas.push(mid);
            const scroll = necesitaScroll
                ? ` (${inicio + 1}–${Math.min(inicio + viewport, archivos.length)}/${archivos.length})`
                : "";
            lineas.push(fila(`${archivos.length} fichero(s) modificado(s)${scroll}`,
                s => Colors.colorize([Colors.FgWhite, Colors.Dim], s)));
        }

        lineas.push(bot);

        const SEP = Colors.colorize([Colors.FgWhite, Colors.Dim], "│");
        const at  = (t: string, d: string) =>
            `${Colors.colorize([Colors.FgWhite, Colors.Bright], t)}  ${Colors.colorize([Colors.FgWhite, Colors.Dim], d)}`;
        const hayDiffables = archivos.some(f => esDiffable(f));
        lineas.push([
            at("↑ ↓", "navegar"),
            ...(hayDiffables ? [at("Intro / →", "ver diff")] : []),
            at("Esc / ←", "volver a la tabla"),
        ].join(`  ${SEP}  `));

        this._dibujarLineas(lineas);
    }

    /** Transiciona a la vista de lista de ficheros. */
    private async iniciarLista(info: IPaqueteGestion): Promise<void> {
        let archivos: IArchivoCambiado[] | null;
        let modo: "enviar" | "actualizar" | "ambos";
        let latest: string;

        if (info.tieneCambiosLocales && info.tieneUpdate && info.versionLatest !== undefined) {
            archivos = await info.paquete.getArchivosCambiadosCombinados(info.versionLatest);
            modo     = "ambos";
            latest   = info.versionLatest;
        } else if (info.tieneCambiosLocales) {
            archivos = await info.paquete.getArchivosCambiados();
            modo     = "enviar";
            latest   = "";
        } else if (info.tieneUpdate && info.versionLatest !== undefined) {
            archivos = await info.paquete.getArchivosModificadosPorUpdate(info.versionLatest);
            modo     = "actualizar";
            latest   = info.versionLatest;
        } else {
            this._procesandoTecla = false;
            return;
        }

        this._listaInfo    = info;
        this._listaCambios = archivos ?? [];
        this._listaModo    = modo;
        this._listaLatest  = latest;
        this._listaScroll  = 0;
        this._listaFila    = 0;
        this.sincronizarScrollLista();
        this._vista = "lista";
        this.dibujarLista();
        this._procesandoTecla = false;
    }

    // ── Vista: diff de un fichero ─────────────────────────────────────────────────

    /** (Re)dibuja el panel de diff con el scroll actual. */
    private dibujarDiff(): void {
        const viewport  = Math.max(5, (process.stdout.rows ?? 24) - 10);
        const total     = this._diffLineas.length;
        const inicio    = this._diffScroll;
        const lineasVis = this._diffLineas.slice(inicio, inicio + viewport);

        const anchoTerminal = process.stdout.columns ?? 80;
        const innerWidth    = Math.max(Math.min(anchoTerminal - 4, 140), 60);
        const {top, mid, bot, filaColoreada} = panelMagenta(innerWidth);

        const filaTit = (() => {
            const BOR       = (s: string) => Colors.colorize([Colors.FgMagenta], s);
            const maxTit    = innerWidth - 2;
            const archivoPart = `Diff — ${this._diffArchivo}`.normalize("NFC");
            const autorPart   = this._diffAutor ? `  ·  ${this._diffAutor}`.normalize("NFC") : "";
            const archivoTrunc = archivoPart.slice(0, maxTit);
            const autorTrunc   = autorPart.slice(0, Math.max(0, maxTit - archivoTrunc.length));
            const relleno      = " ".repeat(Math.max(0, maxTit - archivoTrunc.length - autorTrunc.length));
            return `${BOR("║")}  ${Colors.colorize([Colors.FgMagenta, Colors.Bright], archivoTrunc)}${Colors.colorize([Colors.FgCyan, Colors.Dim], autorTrunc)}${relleno}${BOR("║")}`;
        })();

        const lineas: string[] = [];
        lineas.push(top);
        lineas.push(filaTit);
        lineas.push(mid);

        // Reservar siempre el slot de indicadores cuando el contenido no cabe en un viewport,
        // de modo que el número total de líneas sea constante durante el scroll.
        const necesitaIndicadores = total > viewport;
        if (necesitaIndicadores) {
            lineas.push(filaColoreada(
                inicio > 0
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↑ ··· más líneas arriba ···")
                    : "",
            ));
        }
        for (const l of lineasVis) {
            lineas.push(filaColoreada(l));
        }
        if (necesitaIndicadores) {
            lineas.push(filaColoreada(
                inicio + viewport < total
                    ? Colors.colorize([Colors.FgCyan, Colors.Dim], "  ↓ ··· más líneas abajo ···")
                    : "",
            ));
        }

        lineas.push(bot);

        const SEP    = Colors.colorize([Colors.FgWhite, Colors.Dim], "│");
        const at     = (t: string, d: string) =>
            `${Colors.colorize([Colors.FgWhite, Colors.Bright], t)}  ${Colors.colorize([Colors.FgWhite, Colors.Dim], d)}`;
        const scroll = total > viewport ? ` (${inicio + 1}–${Math.min(inicio + viewport, total)}/${total})` : "";
        lineas.push([
            at("↑ ↓", `desplazar${scroll}`),
            at("Esc / ←", "volver a la lista"),
        ].join(`  ${SEP}  `));

        this._dibujarLineas(lineas);
    }

    /** Transiciona a la vista de diff para el fichero indicado. */
    private async iniciarDiff(info: IPaqueteGestion, item: IArchivoCambiado): Promise<void> {
        const {archivo} = item;
        const origen    = this._listaModo === "ambos" ? item.origen
            : this._listaModo === "actualizar" ? OrigenArchivo.Remoto
            : OrigenArchivo.Local;
        const termW     = process.stdout.columns ?? 80;
        const innerW    = Math.max(Math.min(termW - 4, 140), 60);
        const maxLineWidth = innerW - 2;

        if (origen === OrigenArchivo.Ambos) {
            const [resLocal, resRemoto] = await Promise.all([
                info.paquete.getDiffFichero(archivo),
                info.paquete.getDiffFicheroDesdeRemoto(archivo, this._listaLatest),
            ]);
            // Para side-by-side mostramos el autor del lado "actualizar" (remoto) en el título
            this._diffAutor = resRemoto?.autor ? `por ${resRemoto.autor}` : "";
            if (resLocal !== null && resRemoto !== null) {
                const colWidth = Math.floor((innerW - 5) / 2);
                this._diffLineas = calcularDiffSideBySide(
                    resLocal.original,
                    resLocal.nuevo,
                    resRemoto.nuevo,
                    {
                        offsetBase:   resLocal.offsetOriginal,
                        offsetLocal:  resLocal.offsetNuevo,
                        offsetRemoto: resRemoto.offsetNuevo,
                        colWidth,
                    },
                );
            } else {
                // fallback: diff dual secuencial si alguno no está disponible
                const calc = (res: {original: string; nuevo: string; offsetOriginal: number; offsetNuevo: number} | null, msg: string) =>
                    res !== null
                        ? calcularDiff(res.original, res.nuevo, {offsetA: res.offsetOriginal, offsetB: res.offsetNuevo, maxLineWidth})
                        : [Colors.colorize([Colors.FgYellow], `  ⚠  ${msg}`)];
                this._diffLineas = [
                    Colors.colorize([Colors.FgYellow, Colors.Bright], "  @@ ── Cambios locales (publicado → local) ──"),
                    ...calc(resLocal,  "No se pudo obtener el diff local"),
                    Colors.colorize([Colors.FgYellow, Colors.Bright], "  @@ ── Cambios del update (local → remoto) ──"),
                    ...calc(resRemoto, "No se pudo obtener el diff remoto"),
                ];
            }
        } else {
            const resultado = origen === OrigenArchivo.Remoto
                ? await info.paquete.getDiffFicheroDesdeRemoto(archivo, this._listaLatest)
                : await info.paquete.getDiffFichero(archivo);
            this._diffAutor = resultado?.autor ? `por ${resultado.autor}` : "";
            if (resultado === null) {
                this._diffLineas = [Colors.colorize([Colors.FgYellow], "  ⚠  No se pudo obtener el contenido original")];
            } else {
                this._diffLineas = calcularDiff(resultado.original, resultado.nuevo, {
                    offsetA: resultado.offsetOriginal,
                    offsetB: resultado.offsetNuevo,
                    maxLineWidth,
                });
            }
        }
        this._diffScroll  = 0;
        this._diffArchivo = archivo;
        this._vista       = "diff";
        this.dibujarDiff();
        this._procesandoTecla = false;
    }

    // ── Helper de renderizado ─────────────────────────────────────────────────────

    /** Limpia las líneas anteriores en pantalla y escribe las nuevas. */
    private _dibujarLineas(lineas: string[]): void {
        this._dibujando = true;
        this.render.dibujar(lineas);
        this._dibujando = false;
    }

    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Muestra la tabla interactiva y espera la confirmación del usuario.
     *
     * @param config - Opciones de ejecución ({autoConfirmMs}).
     * @returns Array de acciones seleccionadas por el usuario, o `null` si canceló.
     */
    public async run({autoConfirmMs}: IGestorTablaRunConfig = {}): Promise<Accion[] | null> {
        const logs: string[] = [];
        const restaurar = interceptarSalida(() => this._dibujando, logs);

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        this._dibujando = true;
        process.stdout.write("\x1b[?25l");
        this._dibujando = false;

        if (autoConfirmMs !== undefined) {
            this.segundosRestantes = Math.ceil(autoConfirmMs / 1000);
        }
        this.dibujar();

        return new Promise<Accion[] | null>((resolve) => {
            let timerId: ReturnType<typeof setTimeout> | undefined;
            let intervalId: ReturnType<typeof setInterval> | undefined;

            const cleanup = () => {
                if (timerId !== undefined) { clearTimeout(timerId); }
                if (intervalId !== undefined) { clearInterval(intervalId); }
                this.segundosRestantes = undefined;
                process.stdin.removeListener("keypress", onKeypress);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
                this._dibujando = true;
                process.stdout.write("\x1b[?25h");
                this._dibujando = false;
                restaurar();
                for (const log of logs) {
                    process.stdout.write(`${log}\n`);
                }
            };

            const cancelarTimer = () => {
                if (timerId === undefined) { return; }
                clearTimeout(timerId);
                clearInterval(intervalId!);
                timerId = undefined;
                intervalId = undefined;
                this.segundosRestantes = undefined;
                this.dibujar();
            };

            const onKeypress = (_str: unknown, key: {name: string; ctrl: boolean; sequence: string}) => {
                if (key == null) { return; }
                if (this._procesandoTecla) { return; }

                // ── Vista diff: navegar / volver a lista ──────────────────────
                if (this._vista === "diff") {
                    const viewport = Math.max(5, (process.stdout.rows ?? 24) - 10);
                    if (key.name === "escape" || key.name === "left" || (key.ctrl && key.name === "c")) {
                        this._vista = "lista";
                        this.dibujarLista();
                    } else if (key.name === "up") {
                        this._diffScroll = Math.max(0, this._diffScroll - 1);
                        this.dibujarDiff();
                    } else if (key.name === "down") {
                        this._diffScroll = Math.min(
                            Math.max(0, this._diffLineas.length - viewport),
                            this._diffScroll + 1,
                        );
                        this.dibujarDiff();
                    } else if (key.name === "pageup") {
                        this._diffScroll = Math.max(0, this._diffScroll - viewport);
                        this.dibujarDiff();
                    } else if (key.name === "pagedown") {
                        this._diffScroll = Math.min(
                            Math.max(0, this._diffLineas.length - viewport),
                            this._diffScroll + viewport,
                        );
                        this.dibujarDiff();
                    }
                    return;
                }

                // ── Vista lista: navegar / ver diff / volver a tabla ──────────
                if (this._vista === "lista") {
                    if (key.name === "escape" || key.name === "left" || (key.ctrl && key.name === "c")) {
                        this._vista = "tabla";
                        this.dibujar();
                    } else if (key.name === "up") {
                        this.navegarLista(-1);
                    } else if (key.name === "down") {
                        this.navegarLista(1);
                    } else if (key.name === "pageup") {
                        const viewport = Math.max(3, (process.stdout.rows ?? 24) - 11);
                        this.navegarLista(-1, {paso: viewport});
                    } else if (key.name === "pagedown") {
                        const viewport = Math.max(3, (process.stdout.rows ?? 24) - 11);
                        this.navegarLista(1, {paso: viewport});
                    } else if ((key.name === "return" || key.name === "right") && this._listaInfo !== null) {
                        const item = this._listaCambios[this._listaFila];
                        const info = this._listaInfo;
                        if (item !== undefined && esDiffable(item)) {
                            this._procesandoTecla = true;
                            this.iniciarDiff(info, item).catch(() => {
                                this._procesandoTecla = false;
                                this._vista = "lista";
                            });
                        }
                    }
                    return;
                }

                // ── Vista tabla: comportamiento original ──────────────────────
                cancelarTimer();

                if ((key.ctrl && key.name === "c") || key.name === "escape") {
                    cleanup();
                    resolve(null);
                } else if (key.name === "return") {
                    cleanup();
                    resolve([...this.acciones]);
                } else if (key.name === "up") {
                    this.fila = Math.max(0, this.fila - 1);
                    this.sincronizarScrollTabla();
                    this.dibujar();
                } else if (key.name === "down") {
                    this.fila = Math.min(this.infos.length - 1, this.fila + 1);
                    this.sincronizarScrollTabla();
                    this.dibujar();
                } else if (key.name === "pageup") {
                    const viewport = Math.max(3, (process.stdout.rows ?? 24) - 10);
                    this.fila = Math.max(0, this.fila - viewport);
                    this.sincronizarScrollTabla();
                    this.dibujar();
                } else if (key.name === "pagedown") {
                    const viewport = Math.max(3, (process.stdout.rows ?? 24) - 10);
                    this.fila = Math.min(this.infos.length - 1, this.fila + viewport);
                    this.sincronizarScrollTabla();
                    this.dibujar();
                } else if (key.name === "right" || key.sequence === " ") {
                    this.ciclarAccion(1);
                    this.dibujar();
                } else if (key.name === "left") {
                    this.ciclarAccion(-1);
                    this.dibujar();
                } else if (key.name === "n") {
                    this.aplicarATodos(Accion.Nada);
                    this.dibujar();
                } else if (key.name === "a" && (this.modo === "todos" || this.modo === "update")) {
                    this.aplicarATodos(Accion.Actualizar);
                    this.dibujar();
                } else if (key.name === "r" && (this.modo === "todos" || this.modo === "reset")) {
                    this.aplicarATodos(Accion.Resetear);
                    this.dibujar();
                } else if (key.name === "e" && (this.modo === "todos" || this.modo === "send") && this.hayEnviar) {
                    for (let i = 0; i < this.infos.length; i++) {
                        const disponibles = this.accionesDisponibles(this.infos[i]);
                        if (disponibles.includes(Accion.Enviar)) {
                            this.acciones[i] = Accion.Enviar;
                        } else if (disponibles.includes(Accion.EnviarConUpdate)) {
                            this.acciones[i] = Accion.EnviarConUpdate;
                        }
                    }
                    this.dibujar();
                } else if (key.name === "d" && (this.modo === "todos" || this.modo === "update" || this.modo === "send")) {
                    const info = this.infos[this.fila];
                    if (info.instalado && (info.tieneCambiosLocales || (info.tieneUpdate && info.versionLatest !== undefined))) {
                        this._procesandoTecla = true;
                        this.iniciarLista(info).catch(() => {
                            this._procesandoTecla = false;
                            this._vista = "tabla";
                        });
                    }
                }
            };

            if (autoConfirmMs !== undefined) {
                timerId = setTimeout(() => {
                    cleanup();
                    resolve([...this.acciones]);
                }, autoConfirmMs);

                intervalId = setInterval(() => {
                    if (this.segundosRestantes !== undefined && this.segundosRestantes > 0) {
                        this.segundosRestantes--;
                        this.dibujar();
                    }
                }, 1000);
            }

            process.stdin.on("keypress", onKeypress);
        });
    }
}

