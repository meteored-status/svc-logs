/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 15fb5f3092ec70b3276d96a6ee66acfe
 */

import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {MRPack} from "./mrpack";

process.chdir(`../..`);

MRPack.run();
