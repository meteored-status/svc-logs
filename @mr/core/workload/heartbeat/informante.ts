/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 8495771b4a4d6ff4a9c43a36372e2353
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IInstanciaHeartbeat, IServidorCierre} from "./registro";
import type {IMensajeHeartbeatWorker} from "./workers";
import type {Sonda} from "./sonda";
import {UnSoloVuelo} from "./vuelo";

/**
 * Configuración de {@link InformanteWorker}.
 *
 * @property sonda - Estado de este worker.
 * @property enviar - Manda el mensaje al primario (`process.send`).
 * @property intervaloMs - Periodo del temporizador. Por defecto 1000: el primario cuenta como no listo a un
 *   worker que lleva más de 3 s sin informar.
 */
export interface IConfigInformante {
    sonda: Sonda;
    enviar: (mensaje: IMensajeHeartbeatWorker) => void;
    intervaloMs?: number;
}

/**
 * Lado worker del heartbeat en modo cluster: no habla con el receptor, calcula el estado de su proceso y se
 * lo manda al primario por IPC cada segundo y de inmediato cuando algo cambia. El primario emite un único
 * heartbeat agregado por pod.
 */
export class InformanteWorker implements IInstanciaHeartbeat {
    private readonly sonda: Sonda;
    private readonly enviar: (mensaje: IMensajeHeartbeatWorker) => void;
    private readonly intervaloMs: number;
    private readonly vuelo: UnSoloVuelo;
    private timer: NodeJS.Timeout|null;

    public constructor({sonda, enviar, intervaloMs = 1000}: IConfigInformante) {
        this.sonda = sonda;
        this.enviar = enviar;
        this.intervaloMs = intervaloMs;
        this.vuelo = new UnSoloVuelo(() => this.ciclo());
        this.timer = null;
    }

    public iniciar(): void {
        if (this.timer !== null) {
            return;
        }
        this.timer = setInterval(() => { this.disparar(); }, this.intervaloMs);
        this.timer.unref();
        this.disparar();
    }

    public setEngine(engine: object): void {
        this.sonda.setEngine(engine);
        this.disparar();
    }

    public marcarEjecutado(): void {
        this.sonda.marcarEjecutado();
        this.disparar();
    }

    public disparar(): void {
        this.vuelo.disparar();
    }

    public enlazarServidor(servidor: IServidorCierre): void {
        this.sonda.setConsultaCierre(() => servidor.isShuttingDown());
        servidor.alIniciarCierre(() => {
            this.sonda.marcarSenal();
            this.disparar();
        });
        servidor.antesDeSalir(async () => {
            // Último informe antes de salir, para que el primario no tenga que esperar al silencio.
            this.vuelo.disparar();
            await this.vuelo.inactivo();
        });
    }

    private async ciclo(): Promise<void> {
        const {estado, causaDrenado} = await this.sonda.evaluar();
        this.enviar({cmd: "heartbeat", estado, causaDrenado});
    }
}
