export const yieldToMainBackground = async (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ('scheduler' in window) {
            if ('yield' in (window as any).scheduler) {
                return (window as any).scheduler.yield().then(() => resolve(true));
            }

            if ('postTask' in (window as any).scheduler) {
                return (window as any).scheduler.postTask(() => resolve(true), { priority: 'user-visible' });
            }
        }

        setTimeout(() => { resolve(true) }, 0);
    });
}

export const yieldToMainUiBlocking = async (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ('scheduler' in window) {
            if ('yield' in (window as any).scheduler) {
                return (window as any).scheduler.yield().then(() => resolve(true));
            }

            if ('postTask' in (window as any).scheduler) {
                return (window as any).scheduler.postTask(() => resolve(true), { priority: 'user-blocking' });
            }
        }

        resolve(false);
    });
};
