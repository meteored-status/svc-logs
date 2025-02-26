import {Calculator} from "./calculator";
import {SparkpostCalculator} from "./impl/sparkpost-calculator";
import {SendEvent, TEvent} from "../data/model/send-event";
import {SparkpostEvent} from "../data/model/sparkpost-event";

export class CalculatorBuilder {
    /* STATIC */

    private static instance: CalculatorBuilder|null = null;

    public static getInstance(): CalculatorBuilder {
        if (CalculatorBuilder.instance === null) {
            CalculatorBuilder.instance = new CalculatorBuilder();
        }
        return CalculatorBuilder.instance;
    }

    /* INSTANCE */
    private constructor() {
    }

    public build(event: SendEvent): Calculator {
        switch (event.type) {
            case TEvent.SPAKPOST:
                return new SparkpostCalculator(event as SparkpostEvent);
        }
    }
}
