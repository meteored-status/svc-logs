import {TransactionManager} from "./transaction-manager";
import {error, info} from "../../utiles/log";
import {md5} from "../../utiles/hash";
import {random} from "../../utiles/random";
import {IsolationLevel} from "./isolation";


export interface ITransaction {
    begin(): Promise<void>;

    commit(): Promise<void>;

    rollback(): Promise<void>;
}

export abstract class Transaction implements ITransaction {
    /* STATIC */

    /* INSTANCE */
    private readonly _hash: string;

    protected constructor() {
        const hash = md5(`${random(32)}-${Date.now()}-${random(32)}`);
        this._hash = `${hash.substring(0, 3)}${hash.substring(29)}`;
    }

    public get hash(): string {
        return this._hash;
    }

    public abstract begin(isolationLevel?: IsolationLevel): Promise<void>;

    public abstract commit(): Promise<void>;

    public abstract rollback(): Promise<void>;
}

export type TransactionOptions = {
    name?: string;
    isolationLevel?: IsolationLevel;
}

export const transactional = (getTM: () => TransactionManager, {name, isolationLevel}: TransactionOptions = {}): Function => {
    return function (_target: Object | Function, _propertyKey: string, _descriptor: PropertyDescriptor): void {
        const originalMethod = _descriptor.value;

        _descriptor.value = async function (this: any, ...args: any[]): Promise<any> {
            let t = args.find(arg => arg instanceof Transaction);
            const initial = t === undefined;
            if (!t) {
                t = await getTM().get();
                await t.begin(isolationLevel);
                if (!PRODUCCION) info(`Transaction ${t.hash} => BEGIN${name ? `: ${name}` : ``}`);
            } else {
                if (!PRODUCCION) info(`Transaction ${t.hash} => JOIN${name ? `: ${name}` : ``}`);
            }
            let salida;
            try {
                salida = await originalMethod.apply(this, [...args, t]);
                if (initial) {
                    await t.commit();
                    if (!PRODUCCION) info(`Transaction ${t.hash} => COMMIT${name ? `: ${name}` : ``}`);
                } else {
                    if (!PRODUCCION) info(`Transaction ${t.hash} => LEAVE${name ? `: ${name}` : ``}`);
                }
            } catch (e) {
                if (initial) {
                    error(`Transaction ${t.hash} failed: `, e);
                    await t.rollback();
                    if (!PRODUCCION) info(`Transaction ${t.hash} => ROLLBACK${name ? `: ${name}` : ``}`);
                    salida = Promise.reject(e);
                } else {
                    throw e;
                }
            }
            return salida;
        }
    }
}
