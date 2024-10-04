import type {Traduccion as TraduccionBase} from "..";
import type {ITraduccionLiteralValues} from "../literal";
import type {ITraduccionMapValues} from "../map";
import type {ITraduccionPluralValues} from "../plural";
import type {ITraduccionSetValues} from "../set";

export type ITraduccionValues = ITraduccionLiteralValues | ITraduccionPluralValues | ITraduccionSetValues | ITraduccionMapValues;
export type Traduccion = TraduccionBase<ITraduccionValues>;

export class TraduccionLoader {
}
