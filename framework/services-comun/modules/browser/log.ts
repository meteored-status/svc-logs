export function info(...vars: any[]): void {
    if (!PRODUCCION || TEST) {
        console.log(...vars);
    }
}

export function warn(...vars: any[]): void {
    if (!PRODUCCION || TEST) {
        console.warn(...vars);
    }
}

export function error(...vars: any[]): void {
    if (!PRODUCCION || TEST) {
        console.error(...vars);
    }
}
