/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: e5f13f1453c93c8c50c242265f8250da
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Calculator} from "./calculator";
import {SparkpostCalculator} from "./impl/sparkpost-calculator";
import type {SendEvent} from "../data/model/send-event";
import {TEvent} from "../data/model/send-event";
import type {SparkpostEvent} from "../data/model/sparkpost-event";

export class CalculatorBuilder {
    /* STATIC */

    private static instance: CalculatorBuilder | null = null;

    /* INSTANCE */
    private constructor() {
    }

    public static getInstance(): CalculatorBuilder {
        if (CalculatorBuilder.instance === null) {
            CalculatorBuilder.instance = new CalculatorBuilder();
        }
        return CalculatorBuilder.instance;
    }

    public build(event: SendEvent): Calculator {
        switch (event.type) {
            case TEvent.SPAKPOST:
                return new SparkpostCalculator(event as SparkpostEvent);
        }
    }
}
