import {isBot as isBotBase} from "../net/utiles";

export const isBot = (): boolean => isBotBase(navigator?.userAgent);
