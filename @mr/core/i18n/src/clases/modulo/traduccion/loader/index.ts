/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 326fb5ad45248974f097083fffbdf19a
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
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
