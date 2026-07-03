/**
 * Editor: miguel
 * Fecha: Mon, 22 Jun 2026 08:02:44 GMT
 * Hash: 690a88b66c1d5eca3fd19f80864c3a27
 * Versión: 2026.6.22+1-miguel
 * Anterior: 2026.6.18+1-miguel
 */

import type {IModulo} from ".";
import {ModuloScroll} from "./scroll";
import type {IConf} from "../../utiles/config";

export interface IModuloVisible<T = IConf> extends IModulo {
}

export abstract class ModuloVisible<T extends IModuloVisible = IModuloVisible> extends ModuloScroll<T> {
    /* STATIC */
    protected constructor(cfg: T) {
        super({
            margen: "0px",
            visible: 1.0,
            ...cfg,
        });
    }
}
