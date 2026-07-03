/**
 * Editor: miguel
 * Fecha: Mon, 22 Jun 2026 08:02:44 GMT
 * Hash: e9573a164a0e7485dc316b08aee04a88
 * Versión: 2026.6.22+1-miguel
 * Anterior: 2026.6.18+1-miguel
 */


import {type IModulo, Modulo} from ".";
import type {IConf} from "../../utiles/config";

export interface IModuloScroll<T = IConf> extends IModulo<T> {
    margen?: string;
    visible?: number;
}

export abstract class ModuloScroll<T extends IModuloScroll = IModuloScroll> extends Modulo<T> {
    /* STATIC */
    protected constructor(cfg: T) {
        super({
            margen: "100px",
            visible: 0.0,
            ...cfg,
        });
    }

    protected override async runElement(element: HTMLElement): Promise<void> {
        // https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
        new IntersectionObserver((entries, observer)=>{
            entries.forEach(entry=>{
                if (entry.isIntersecting) {
                    super.runElement(element).then(()=>{});
                    // observer.unobserve(element);
                }
            });
        }, {
            rootMargin: this.cfg.margen,
            threshold: this.cfg.visible,
        }).observe(element);
    }
}
