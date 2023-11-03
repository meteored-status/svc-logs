import {createHash} from "node:crypto";

export function md5(entrada: string): string {
    return createHash('md5').update(entrada).digest("hex");
}
