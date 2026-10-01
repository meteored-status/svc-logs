/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: cb50694076e85b51094b8c7b3f5f2bbc
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Prioridad} from "./scheduler";
import {type Window} from "./scheduler";

export async function PromiseDelayed(delay: number = 0, priority?: Prioridad): Promise<void> {
    if (delay>0 || !priority) {
        return new Promise<void>((resolve: Function) => {
            setTimeout(() => {
                resolve();
            }, delay);
        });
    }

    const w = window as Window;
    if (w.scheduler) {
        if (w.scheduler.yield) {
            await w.scheduler.yield();
        } else {
            await w.scheduler.postTask(()=>{}, {priority});
        }
    } else {
        await Promise.resolve();
    }
}
