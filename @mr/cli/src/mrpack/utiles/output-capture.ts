/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: dc31c941af13182318fb940f66f08237
 * Versión: 2026.5.27+1-josantoniojimnez
 */

/**
 * Intercepta `process.stdout` y `process.stderr` durante una operación de larga duración.
 *
 * Deja pasar únicamente la salida cuando `esCli()` devuelve `true`; el resto se acumula
 * en el array `logs` para mostrarlo al finalizar. Útil para mantener limpia la progresión
 * de la consola mientras operaciones paralelas imprimen mensajes secundarios.
 *
 * @param esCli - Predicado que devuelve `true` cuando la salida proviene del hilo principal
 *                de la consola (p.ej., mientras se dibuja la línea de progreso).
 * @param logs  - Array en el que se acumulan los mensajes capturados.
 * @returns Función que restaura los streams originales; debe llamarse al terminar la operación.
 */
export function interceptarSalida(esCli: () => boolean, logs: string[]): () => void {
    const origOut = process.stdout.write.bind(process.stdout) as typeof process.stdout.write;
    const origErr = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;

    const makeCapturer = (orig: typeof process.stdout.write): typeof process.stdout.write => {
        return (chunk: string | Uint8Array, encodingOrCb?: BufferEncoding | ((err?: Error | null) => void), cb?: (err?: Error | null) => void): boolean => {
            if (esCli()) {
                return orig(chunk as string, encodingOrCb as BufferEncoding, cb);
            }
            const text = (typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()).replace(/\n$/, "");
            if (text.length > 0) {
                logs.push(text);
            }
            if (typeof encodingOrCb === "function") {
                encodingOrCb();
            } else if (typeof cb === "function") {
                cb();
            }
            return true;
        };
    };

    process.stdout.write = makeCapturer(origOut);
    process.stderr.write = makeCapturer(origErr);

    return () => {
        process.stdout.write = origOut;
        process.stderr.write = origErr;
    };
}

