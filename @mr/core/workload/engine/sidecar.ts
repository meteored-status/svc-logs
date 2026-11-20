/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 9184c6ee7f09a1f6162de8a7a39854e2
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import http from "node:http";

import {Deferred} from "services-comun/modules/utiles/promise";

/**
 * Puerto del agente de Istio (`pilot-agent`) en el pod: `/healthz/ready` y `/quitquitquit`.
 */
export const PUERTO_AGENTE_ISTIO = 15020;

/**
 * Lo más que se espera a que el sidecar conteste a `/quitquitquit`. Contesta al momento; el tope es para que un proxy que acepta la
 * conexión y no responde no deje el proceso sin salir.
 */
export const PARADA_SIDECAR_MAX_MS = 2000;

/**
 * Configuración de {@link pararSidecar}.
 *
 * @property puerto - Puerto del agente de Istio. Por defecto {@link PUERTO_AGENTE_ISTIO}.
 * @property maxMs - Tope de espera a la respuesta. Por defecto {@link PARADA_SIDECAR_MAX_MS}.
 */
export interface IConfigPararSidecar {
    puerto?: number;
    maxMs?: number;
}

/**
 * Pide al sidecar de Istio que se pare (`POST /quitquitquit`). Sin sidecar nativo, `istio-proxy` es un contenedor más del pod y no
 * termina cuando sale la aplicación: sin esto el pod de un Job se queda en `Running` y el Job no acaba nunca.
 *
 * Resuelve en cuanto llega la respuesta, si la conexión falla (el proceso puede estar ya cerrándose, o no hay sidecar) o al pasar
 * `maxMs`, lo que ocurra antes. **Nunca rechaza**.
 */
export async function pararSidecar({puerto = PUERTO_AGENTE_ISTIO, maxMs = PARADA_SIDECAR_MAX_MS}: IConfigPararSidecar = {}): Promise<void> {
    const deferred = new Deferred<void>();
    let resuelto = false;
    let temporizador: NodeJS.Timeout|null = null;
    const fin = (): void => {
        if (!resuelto) {
            resuelto = true;
            if (temporizador !== null) {
                clearTimeout(temporizador);
            }
            deferred.resolve();
        }
    };

    const conexion = http.request({
        protocol: "http:",
        method: "POST",
        hostname: "localhost",
        port: puerto,
        path: "/quitquitquit",
    }, (message)=>{
        message.on("error", ()=>undefined);
        message.on("end", ()=>undefined);
        message.resume();
        fin();
    });
    conexion.on("error", ()=>{
        fin();
    });
    temporizador = setTimeout(()=>{
        fin();
        conexion.destroy();
    }, maxMs);
    conexion.end();

    await deferred.promise;
}
