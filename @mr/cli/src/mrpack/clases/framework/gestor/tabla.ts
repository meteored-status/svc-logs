/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 44bd976d2a2abb16bc688ac6f7307376
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import readline from "node:readline";

import {maquetarVersion, parsearFechaVersion} from "../../../utiles/version";
import {interceptarSalida} from "../../../utiles/output-capture";
import {Colors} from "../../colors";
import {FrameworkUpdates} from "../../workspace/service";
import {Accion, type IPaqueteGestion} from "./datos";

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
    private lineasDibujadas: number;
    private _dibujando: boolean;
    private readonly modo: GestorModo;
    private segundosRestantes: number | undefined;
    private readonly slots: {key: Accion; ancho: number}[];
    private readonly frameworkUpdates: FrameworkUpdates;

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
        this.lineasDibujadas    = 0;
        this._dibujando         = false;

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
            case "update":
            case "todos":
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

    private dibujar(): void {
        const lineas: string[] = [];
        lineas.push(this.renderCabecera());
        lineas.push(Colors.colorize([Colors.Dim],
            "─".repeat(4 + this.maxTipo + 3 + this.maxNombre + 3 + 14 + 3 + 14 + 3 + this.anchoAcciones)));
        for (let i = 0; i < this.infos.length; i++) {
            lineas.push(this.renderFila(i));
        }
        lineas.push("");
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
        lineas.push(atajos.join(`  ${SEP_AYUDA}  `));

        if (this.segundosRestantes !== undefined) {
            lineas.push(Colors.colorize([Colors.FgYellow, Colors.Dim],
                `  Auto-confirma en ${this.segundosRestantes}s — pulsa cualquier tecla para cancelar`));
        }

        this._dibujando = true;
        if (this.lineasDibujadas > 0) {
            process.stdout.write(Colors.up(this.lineasDibujadas));
        }
        for (const linea of lineas) {
            process.stdout.write(`\r\x1b[K${linea}\n`);
        }
        this._dibujando = false;
        this.lineasDibujadas = lineas.length;
    }

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

                cancelarTimer();

                if ((key.ctrl && key.name === "c") || key.name === "escape") {
                    cleanup();
                    resolve(null);
                } else if (key.name === "return") {
                    cleanup();
                    resolve([...this.acciones]);
                } else if (key.name === "up") {
                    this.fila = Math.max(0, this.fila - 1);
                    this.dibujar();
                } else if (key.name === "down") {
                    this.fila = Math.min(this.infos.length - 1, this.fila + 1);
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

