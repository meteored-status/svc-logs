export const enum Prioridad {
    BACKGROUND = "background",
    VISIBLE = "user-visible",
    BLOCKING = "user-blocking",
}

export interface Scheduler {
    postTask<T>(task: () => T, options?: { priority?: Prioridad, signal?: AbortSignal, delay?: number }): Promise<void>;
    yield?: () => Promise<void>;
}

export interface Window {
    scheduler?: Scheduler;
}
