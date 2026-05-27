/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 25 May 2026 14:46:33 GMT
 * Hash: 4f3cfddc64e73929a66cec360a6f915b
 * Versión: 2026.5.25+3-josantoniojimnez
 */

import {isbot as isBotBase} from "isbot";

export const isBot = (): boolean => isBotBase(navigator?.userAgent);
