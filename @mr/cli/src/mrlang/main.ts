/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: cbd7a02284b3335aac1e1d2c1720af78
 */

import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import {MRLang} from "./mrlang";

process.chdir(`../..`);

MRLang.run();
