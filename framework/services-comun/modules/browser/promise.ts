import {Prioridad, type Window} from "./scheduler";

export async function PromiseDelayed(delay: number = 0, priority?: Prioridad): Promise<void> {
    if (delay>0 || priority==undefined) {
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
