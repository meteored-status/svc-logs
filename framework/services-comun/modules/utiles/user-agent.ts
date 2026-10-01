/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 7fffdad7353c4283d6bb4d571917592e
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.25+3-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {isbot as isBotBase} from "isbot";

import type {Conexion} from "@mr/core-network/server/http/conexion";

export const isBot = (conexion: Conexion): boolean => {
    return isBotBase(conexion.userAgent??'');
}
