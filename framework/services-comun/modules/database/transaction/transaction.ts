/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: afc96e6de3c1d7b4ac15d070e6b0d771
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.7.3+1-juancmartinez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {TransactionManager} from "./transaction-manager";
import {error, info} from "../../utiles/log";
import {md5} from "../../utiles/hash";
import {random} from "../../utiles/random";
import type {IsolationLevel} from "./isolation";

export interface ITransaction {
    begin(): Promise<void>;

    commit(): Promise<void>;

    rollback(): Promise<void>;
}

export abstract class Transaction implements ITransaction {
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
    return (originalMethod: any, _context: ClassMethodDecoratorContext) => {
        return async function (this: any, ...args: any[]): Promise<any> {
            let t = args.find(arg => arg instanceof Transaction);
            const initial = t === undefined;
            if (!t) {
                t = await getTM().get();
                await t.begin(isolationLevel);
                if (!PRODUCCION) {info(`Transaction ${t.hash} => BEGIN${name ? `: ${name}` : ``}`);}
            } else {
                if (!PRODUCCION) {info(`Transaction ${t.hash} => JOIN${name ? `: ${name}` : ``}`);}
            }
            let salida;
            try {
                salida = await originalMethod.apply(this, [...args, t]);
                if (initial) {
                    await t.commit();
                    if (!PRODUCCION) {info(`Transaction ${t.hash} => COMMIT${name ? `: ${name}` : ``}`);}
                } else {
                    if (!PRODUCCION) {info(`Transaction ${t.hash} => LEAVE${name ? `: ${name}` : ``}`);}
                }
            } catch (e) {
                if (initial) {
                    error(`Transaction ${t.hash} failed: `, e);
                    await t.rollback();
                    if (!PRODUCCION) {info(`Transaction ${t.hash} => ROLLBACK${name ? `: ${name}` : ``}`);}
                    salida = Promise.reject(e);
                } else {
                    throw e;
                }
            }
            return salida;
        }
    }
}
