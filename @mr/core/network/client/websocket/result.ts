import {Deferred} from "services-comun/modules/utiles/promise";

import type {IResponse} from "../..";
import type {IMessageServerKO, IMessageServerOK, IStreamFrame} from "../../metadata/websocket/message";

/**
 * Encapsula el `AsyncGenerator` devuelto por {@link WSPool.get} y expone el método
 * {@link next} para consumir los mensajes del servidor de forma tipada.
 *
 * Cada elemento del generator es un {@link IStreamFrame} que contiene el mensaje
 * JSON del servidor y, cuando {@link IMessageServerOK.buffer} es `true`, el frame
 * binario (`ArrayBuffer`) recibido inmediatamente después.
 *
 * Puede iterarse directamente con `for await…of` sobre `generator` o consumirse
 * mensaje a mensaje mediante {@link next} y {@link consume}.
 *
 * Para consumir varios mensajes en paralelo con fallback HTTP, usar {@link pipe}.
 */
export class Result {
    /**
     * @param generator - Generator interno de frames WebSocket.
     */
    public constructor(public readonly generator: AsyncGenerator<IStreamFrame, void, unknown>) {
        // suprimir dd warning
    }

    /**
     * Consume el siguiente frame del generator y devuelve una `Promise` con la respuesta.
     *
     * Si el mensaje recibido tiene `ok: false`, la promesa rechaza con el mensaje de error
     * del servidor. De lo contrario, resuelve con {@link IResponse}:
     * - `data` contendrá el payload JSON.
     * - `buffer` estará presente cuando la respuesta incluya un frame binario (`buffer: true`).
     * - `expires` refleja el timestamp de expiración de caché si el servidor lo indicó.
     *
     * Para consumir varios mensajes en paralelo **con fallback HTTP**, usar {@link pipe}.
     * Para obtener el comportamiento "rechaza el Deferred en error" (sin fallback),
     * usar {@link consume} directamente: `consume(generator.next(), deferred)`.
     *
     * @template T - Tipo del valor esperado en el mensaje.
     */
    public next<T>(): Promise<IResponse<T>> {
        return this.consume(this.generator.next());
    }

    /**
     * Procesa el `IteratorResult` devuelto por una llamada previa a `generator.next()`
     * y lo entrega al `Deferred` dado o devuelve una `Promise` si se omite.
     *
     * Útil cuando el llamador ya ha invocado `generator.next()` fuera de este objeto
     * (p. ej. para paralelizar varias lecturas) y delega el procesamiento del resultado.
     *
     * - Sin `deferred`: crea un `Deferred` interno y devuelve su promesa.
     * - Con `deferred`: resuelve/rechaza el `Deferred` proporcionado y devuelve `void`.
     *
     * Si el mensaje tiene `ok: false`, el `Deferred` se rechaza con el mensaje de error
     * del servidor. De lo contrario, se resuelve con {@link IResponse}:
     * - `data` contendrá el payload JSON cuando el mensaje lo incluya.
     * - `buffer` estará presente cuando la respuesta incluya un frame binario (`buffer: true`).
     * - `expires` refleja el timestamp de expiración de caché si el servidor lo indicó.
     *
     * @template T - Tipo del valor esperado en el mensaje.
     * @param promise - Promesa devuelta por `generator.next()`.
     */
    public consume<T>(promise: Promise<IteratorResult<IStreamFrame, void>>): Promise<IResponse<T>>;
    public consume<T>(promise: Promise<IteratorResult<IStreamFrame, void>>, deferred: Deferred<IResponse<T>>): void;
    public consume<T>(promise: Promise<IteratorResult<IStreamFrame, void>>, deferred?: Deferred<IResponse<T>>): Promise<IResponse<T>> | void {
        const defer = deferred ?? new Deferred<IResponse<T>>();
        promise
            .then((result) => {
                const frame = result.value as IStreamFrame | undefined;
                if (!frame) {
                    defer.reject(new Error("WebSocket stream ended unexpectedly"));
                    return;
                }
                if (!frame.message.ok) {
                    defer.reject(new Error((frame.message as IMessageServerKO).info.message ?? "WebSocket error"));
                } else {
                    const ok = frame.message as IMessageServerOK<T>;
                    if (frame.buffer !== undefined) {
                        defer.resolve({
                            data: ok.data,
                            expires: ok.metadata?.expires,
                            buffer: frame.buffer,
                        } as IResponse<T>);
                    } else {
                        defer.resolve({
                            data: ok.data,
                            expires: ok.metadata?.expires,
                        } as IResponse<T>);
                    }
                }
            })
            .catch((err) => {
                defer.reject(err);
            });
        if (!deferred) {
            return defer.promise;
        }
    }

    /**
     * Consume N mensajes en paralelo, resolviendo cada `Deferred` en cuanto llega
     * su mensaje, **sin rechazarlos si hay un error**.
     *
     * Diferencia clave respecto a llamar a `next(deferred)` N veces:
     * - `next(deferred)` rechaza el `Deferred` si el mensaje falla.
     * - `pipe(...deferreds)` deja los `Deferred` pendientes ante un error y en su
     *   lugar rechaza la promesa devuelta, permitiendo que el llamador aplique un
     *   fallback que resuelva los `Deferred` que aún no estén liquidados.
     *
     * Uso típico con fallback HTTP:
     * ```ts
     * const respuesta = await POOL.get("/metodo/full/", params);
     * respuesta.pipe(d1, d2)
     *     .catch(() => {
     *         fallbackHTTP(d1, d2); // solo resuelve los aún pendientes
     *     });
     * ```
     *
     * @returns Promesa que resuelve cuando todos los mensajes han llegado, o rechaza
     *   en cuanto cualquiera falla (los `Deferred` pendientes quedan sin liquidar).
     */
    public pipe<A>(d1: Deferred<IResponse<A>>): Promise<void>;
    public pipe<A, B>(d1: Deferred<IResponse<A>>, d2: Deferred<IResponse<B>>): Promise<void>;
    public pipe<A, B, C>(d1: Deferred<IResponse<A>>, d2: Deferred<IResponse<B>>, d3: Deferred<IResponse<C>>): Promise<void>;
    public pipe(...deferreds: Deferred<IResponse<unknown>>[]): Promise<void> {
        const promises = deferreds.map(deferred => {
            const p = this.next<unknown>();
            // Resolvemos el Deferred en cuanto llega el mensaje, sin esperar al resto.
            // Si p rechaza, el .then() no dispara (Deferred queda pendiente para fallback)
            // y el .catch() suprime el rechazo aquí; el error se propaga vía Promise.all.
            p.then(r => deferred.resolve(r)).catch(() => undefined);
            return p;
        });
        return Promise.all(promises).then(() => undefined);
    }
}

