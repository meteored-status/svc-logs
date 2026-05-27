/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 326fb5ad45248974f097083fffbdf19a
 */

import type {Traduccion as TraduccionBase} from "..";
import type {ITraduccionLiteralValues} from "../literal";
import type {ITraduccionMapValues} from "../map";
import type {ITraduccionPluralValues} from "../plural";
import type {ITraduccionSetValues} from "../set";

export type ITraduccionValues = ITraduccionLiteralValues | ITraduccionPluralValues | ITraduccionSetValues | ITraduccionMapValues;
export type Traduccion = TraduccionBase<ITraduccionValues>;

export class TraduccionLoader {
}
