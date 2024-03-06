import {isBot as isBotBase} from "../net/utiles";

export const isBot = (): boolean => {
    if (!navigator || !navigator.userAgent) return false;

    const ua = navigator.userAgent;
    return isBotBase(ua);
}
