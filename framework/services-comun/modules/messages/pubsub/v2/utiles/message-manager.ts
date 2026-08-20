/**
 * Editor: Bixus
 * Fecha: Tue, 18 Aug 2026 12:16:10 GMT
 * Hash: 48f068dade9924e1b5eb1aaedb4db371
 * Versión: 2026.8.18+1-bixus
 * Anterior: 2026.6.2+1-juancmartinez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {warning} from "../../../../utiles/log";

type Lock = string;

/**
 * Interfaz para la gestión de locks distribuidos.
 *
 * @property acquireLock - Intenta adquirir un lock sobre los nombres indicados con un TTL en segundos.
 *   Rechaza la promesa si el lock ya está tomado.
 * @property releaseLock - Libera el lock previamente adquirido sobre los nombres indicados.
 */
export interface LockDAO {
    acquireLock: (lockNames: string[], ttl: number) => Promise<Lock>;
    releaseLock: (lockNames: string[], lock: Lock) => Promise<void>;
}

/**
 * Gestiona el ciclo de vida del procesamiento de un mensaje pub/sub mediante locks distribuidos,
 * garantizando que un mensaje no se procese de forma concurrente ni duplicada.
 *
 * El flujo habitual es:
 * 1. `startProcessing()` — adquiere el lock de procesamiento (TTL 10 min) y el lock de procesado (TTL 24 h).
 * 2. Lógica de negocio del consumidor.
 * 3. `endProcessing()` — libera el lock de procesamiento (el lock de procesado permanece activo).
 * 4. Si ocurre un error en el paso 2, llamar a `errorProcessing()` para liberar ambos locks.
 */
export class MessageManager {
    /* STATIC */

    /* INSTANCE */
    private readonly lockMessageProcessingKey: string;
    private readonly lockMessageProcessedKey: string;

    private lockMessageProcessing: string|null;
    private lockMessageProcessed: string|null;

    /**
     * @param messageId   - Identificador único del mensaje.
     * @param messageType - Tipo o categoría del mensaje, usado como prefijo en las claves de lock.
     * @param daoLock     - Implementación del DAO de locks distribuidos.
     */
    public constructor(
        private readonly messageId: string,
        private readonly messageType: string,
        private readonly daoLock: LockDAO
    ) {
        this.lockMessageProcessingKey = `${this.messageType}:message-processing:${this.messageId}`;
        this.lockMessageProcessedKey = `${this.messageType}:message-processed:${this.messageId}`;
        this.lockMessageProcessing = null;
        this.lockMessageProcessed = null;
    }

    /**
     * Inicia el procesamiento del mensaje adquiriendo los locks necesarios.
     *
     * Primero adquiere el lock de procesamiento (TTL 10 min) para evitar procesamiento concurrente.
     * A continuación adquiere el lock de procesado (TTL 24 h) para evitar procesamientos duplicados.
     * Si alguno de los locks no se puede obtener, lanza el error correspondiente y libera los locks
     * que se hubieran adquirido previamente.
     *
     * @throws {ProcessingMessageError} Si el mensaje ya está siendo procesado.
     * @throws {ProcessedMessageError}  Si el mensaje ya fue procesado anteriormente.
     */
    public async startProcessing(): Promise<void> {

        // Comprobamos que no hayamos recibido ya este mensaje
        this.lockMessageProcessing = await this.daoLock.acquireLock([this.lockMessageProcessingKey], 600).catch(() => {
            warning(`El mensaje ${this.messageId} se está procesando`)
            return null;
        }); // Lock de 10 minutos

        if (!this.lockMessageProcessing) {
            throw new ProcessingMessageError(this.messageId, this.messageType);
        }

        // El mensaje no se está procesando. Comprobamos si ya se ha procesado.
        this.lockMessageProcessed = await this.daoLock.acquireLock([this.lockMessageProcessedKey], 24 * 60 * 60).catch(() => {
            warning(`El mensaje ${this.messageId} ya ha sido procesado`);
            return null;
        }); // Lock de 24 horas

        if (!this.lockMessageProcessed) {
            // Liberamos el procesamiento
            try {
                await this.daoLock.releaseLock([this.lockMessageProcessingKey], this.lockMessageProcessing);
            } catch (e) {
                warning(`Error liberando el lock de procesamiento del mensaje ${this.messageId} del tipo ${this.messageType}`, e);
            }
            throw new ProcessedMessageError(this.messageId, this.messageType);
        }
    }

    /**
     * Gestiona el estado de error durante el procesamiento del mensaje.
     *
     * Libera tanto el lock de procesamiento como el lock de procesado, permitiendo que el mensaje
     * pueda ser procesado de nuevo en un futuro intento.
     */
    public async errorProcessing(): Promise<void> {

        // Liberamos el procesamiento
        try {
            if (this.lockMessageProcessing) {
                await this.daoLock.releaseLock([this.lockMessageProcessingKey], this.lockMessageProcessing);
            }

            if (this.lockMessageProcessed) {
                await this.daoLock.releaseLock([this.lockMessageProcessedKey], this.lockMessageProcessed);
            }
        } catch (e) {
            warning(`Error liberando los locks del mensaje ${this.messageId} del tipo ${this.messageType} tras error en el procesamiento`, e);
        }
    }

    /**
     * Finaliza el procesamiento exitoso del mensaje.
     *
     * Libera únicamente el lock de procesamiento. El lock de procesado permanece activo durante
     * 24 horas para evitar que el mismo mensaje sea procesado de nuevo.
     */
    public async endProcessing(): Promise<void> {

        // Liberamos el procesamiento
        try {
            if (this.lockMessageProcessing) {
                await this.daoLock.releaseLock([this.lockMessageProcessingKey], this.lockMessageProcessing);
            }
        } catch (e) {
            warning(`Error liberando el lock de procesamiento del mensaje ${this.messageId} del tipo ${this.messageType}`, e);
        }
    }
}

/**
 * Códigos de error para los distintos estados de procesamiento de un mensaje.
 *
 * - `PROCESSING` — el mensaje ya está siendo procesado por otro consumidor.
 * - `PROCESSED`  — el mensaje ya fue procesado anteriormente y no debe volver a procesarse.
 */
export enum MessageErrorCode {
    PROCESSING = 1,
    PROCESSED = 2,
}

/**
 * Clase base abstracta para los errores de procesamiento de mensajes.
 *
 * Extiende `Error` añadiendo un código de error tipado ({@link MessageErrorCode}) que permite
 * diferenciar el motivo del fallo sin necesidad de inspeccionar el mensaje de texto.
 */
export abstract class MessageError extends Error {
    protected constructor(private readonly _code: MessageErrorCode, message: string) {
        super(message);
    }

    public get code(): MessageErrorCode {
        return this._code;
    }
}

/**
 * Error lanzado cuando se intenta procesar un mensaje que ya está siendo procesado
 * de forma concurrente por otro consumidor.
 */
export class ProcessingMessageError extends MessageError {
    public constructor(messageId: string, messageType: string) {
        super(MessageErrorCode.PROCESSING, `El mensaje ${messageId} del tipo ${messageType} se está procesando`);
    }
}

/**
 * Error lanzado cuando se intenta procesar un mensaje que ya fue procesado anteriormente
 * y cuyo lock de procesado aún está activo.
 */
export class ProcessedMessageError extends MessageError {
    public constructor(messageId: string, messageType: string) {
        super(MessageErrorCode.PROCESSED, `El mensaje ${messageId} del tipo ${messageType} ya ha sido procesado`);
    }
}
