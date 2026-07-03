/**
 * Editor: miguel
 * Fecha: Thu, 02 Jul 2026 09:01:51 GMT
 * Hash: bb202df35c56f8a7adaa1086d03f8c55
 * Versión: 2026.7.2+1-miguel
 * Anterior: 2026.6.26+1-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import type {Idioma} from "@mr/core-i18n/langs";
import {immute} from "services-comun/modules/utiles/object";

import type {TDevice} from "@mr/core-templates/device";

export interface IConfEndpoints {
    www: string;
    services: string;
}

export interface IConf {
    device: TDevice;
    section: string;
    timezone?: string;
    lang: {
        current: Idioma;
        default: Idioma;
    };
    endpoints: IConfEndpoints;
    search: {
        country: number;
    }
}

declare const window: Window & {_mr_: IConf;};

export default immute(window["_mr_"]);
