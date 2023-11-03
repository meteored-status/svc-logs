export async function PromiseDelayed(delay: number = 0): Promise<void> {
    if (delay>0) {
        return new Promise<void>((resolve: Function) => {
            setTimeout(() => {
                resolve();
            }, delay);
        });
    }
    return new Promise<void>((resolve: Function) => {
        resolve();
    });
}
