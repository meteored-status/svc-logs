/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: d786f7b20b8b74400065cbe2f146a1b2
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Ejecuta una tarea asíncrona con **un solo vuelo a la vez**: si se pide mientras la anterior no ha
 * terminado, no se encola una por petición, se anota que hay que repetirla y, al acabar, se hace **una**
 * más (que verá el estado más reciente). Nunca se acumulan peticiones viejas.
 */
export class UnSoloVuelo {
    private readonly tarea: () => Promise<void>;
    private enCurso: Promise<void>|null;
    private pendiente: boolean;

    /**
     * @param tarea - Lo que se ejecuta. No debería rechazar; si lo hace, se ignora.
     */
    public constructor(tarea: () => Promise<void>) {
        this.tarea = tarea;
        this.enCurso = null;
        this.pendiente = false;
    }

    /**
     * Pide una ejecución. Si hay una en curso, la repetirá cuando acabe.
     */
    public disparar(): void {
        if (this.enCurso !== null) {
            this.pendiente = true;
            return;
        }
        this.enCurso = this.bucle();
    }

    /**
     * Resuelve cuando no queda nada en curso ni pendiente.
     */
    public async inactivo(): Promise<void> {
        while (this.enCurso !== null) {
            await this.enCurso;
        }
    }

    private async bucle(): Promise<void> {
        // Cede un turno para que `enCurso` ya esté asignado cuando termine, aunque la tarea falle al instante.
        await Promise.resolve();
        try {
            do {
                this.pendiente = false;
                try {
                    await this.tarea();
                } catch {
                    // La tarea gestiona sus errores; aquí solo se evita romper el bucle.
                }
            } while (this.pendiente);
        } finally {
            this.enCurso = null;
        }
    }
}
