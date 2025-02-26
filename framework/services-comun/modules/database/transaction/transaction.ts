import {TransactionManager} from "./transaction-manager";
import {error, info} from "../../utiles/log";
import {md5} from "../../utiles/hash";
import {random} from "../../utiles/random";

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

    public abstract begin(): Promise<void>;
    public abstract commit(): Promise<void>;
    public abstract rollback(): Promise<void>;
}

export const transactional = (getTM: () => TransactionManager, name?: string): Function => {
    return (originalMethod: any) => {
        return function (this: any, ...args: any[]) {
            return Promise.resolve().then(async ()=> {
                let t = args.find(arg => arg instanceof Transaction);
                const initial = t === undefined;
                if (!t) {
                    t = await getTM().get();
                    await t.begin();
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
            });
        }
    }
}
