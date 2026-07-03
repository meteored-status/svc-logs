/**
 * Editor: miguel
 * Fecha: Thu, 18 Jun 2026 07:22:19 GMT
 * Hash: 406f30053a88d59f6ce00571e9818750
 * Versión: 2026.6.18+1-miguel
 */

import {error, info, warn} from "services-comun/modules/browser/log";

import {Modulo} from "./index";

export const enum EModuloError {
    INFO,
    WARNING,
    ERROR,
}

export class ModuloError extends Error {
    /* STATIC */
    public static info(message: string): ModuloError {
        return new ModuloError(message, EModuloError.INFO);
    }

    public static warning(message: string): ModuloError {
        return new ModuloError(message, EModuloError.WARNING);
    }

    public static error(message: string): ModuloError {
        return new ModuloError(message, EModuloError.ERROR);
    }

    public static show(modulo: Modulo, err: any): void {
        if (err instanceof Error || (typeof err === 'object' && 'message' in err)) {
            if ("nivel" in err) {
                switch(err.nivel) {
                    case EModuloError.INFO:
                        info(`${modulo.nombre} => ${err.message}`);
                        break;
                    case EModuloError.WARNING:
                        warn(`${modulo.nombre} => ${err.message}`);
                        break;
                    case EModuloError.ERROR:
                    default:
                        error(`${modulo.nombre} => ${err.message}`);
                        break;
                }
            } else {
                error(`${modulo.nombre} => ${err.message}`);
            }
        } else {
            error(`${modulo.nombre} => ${JSON.stringify(err)}`);
        }
    }

    /* INSTANCE */
    public constructor(message: string, public nivel: EModuloError) {
        super(message);
    }
}
