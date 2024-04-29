export function info(...vars: any[]): void {
    if (!PRODUCCION) {
        console.log(...vars);
    }
}

export function warn(...vars: any[]): void {
    if (!PRODUCCION) {
        console.warn(...vars);
    }
}

export function error(...vars: any[]): void {
    if (!PRODUCCION) {
        console.error(...vars);
    }
}
