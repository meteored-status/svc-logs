/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 15fb5f3092ec70b3276d96a6ee66acfe
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {MRPack} from "./mrpack";

process.chdir(`../..`);

MRPack.run();
