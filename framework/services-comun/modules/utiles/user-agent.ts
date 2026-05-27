/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 25 May 2026 14:46:33 GMT
 * Hash: a9ab3eadc4509851efbb89f938c3370e
 * Versión: 2026.5.25+3-josantoniojimnez
 */

import {isbot as isBotBase} from "isbot";
import {Conexion} from "@mr/core-network/server/http/conexion";

export const isBot = (conexion: Conexion): boolean => {
    return isBotBase(conexion.userAgent??'');
}
