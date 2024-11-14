import {BulkOperationContainer, BulkResponseItem, BulkUpdateAction, Script} from "@elastic/elasticsearch/lib/api/types";

import {ESBulkResponse} from "../index";

type TBulkAction = "index"|"update"|"delete"|"create";

export type BulkType<T> = (BulkOperationContainer | BulkUpdateAction<T, Partial<T>> | T);

export interface IBulkBase<T> {
    index: string;
    id?: string;
    doc: T;
}

export abstract class BulkBase<T=void, C={}> {
    // public readonly data: string[];
    public readonly bulk: BulkType<T>[];
    // public readonly size: number;

    protected constructor(obj: IBulkBase<T>, private resolver: Function, private rejecter: Function, private accion: TBulkAction, protected settings: C) {
        // this.data = [];
        this.bulk = this.toBulk(obj);
        // this.size = 0;
        // for (const actual of this.bulk) {
        //     const data = JSON.stringify(actual);
            // this.data.push(data);
            // this.size += data.length;
        // }
    }

    public resolve(data?: BulkResponseItem): void {
        this.resolver(data);
    }

    public reject(data?: BulkResponseItem): void {
        this.rejecter(data);
    }

    public end(data: ESBulkResponse): boolean {
        const resultado = data[this.accion];
        if (resultado!=undefined) {
            if (resultado.error==undefined) {
                this.resolve(resultado);

                return true;
            }

            this.reject(resultado);

            return false;
        }

        this.reject();

        return false;
    }

    protected abstract toBulk(obj: IBulkBase<T>): BulkType<T>[];
}

export class BulkIndex<T> extends BulkBase<T> {
    public constructor(doc: IBulkBase<T>, resolver: Function, rejecter: Function) {
        super(doc, resolver, rejecter, "index", {});
    }

    protected toBulk(obj: IBulkBase<T>): BulkType<T>[] {
        return [
            {
                index: {
                    _index: obj.index,
                    _id: obj.id,
                },
            },
            obj.doc,
        ];
    }
}

export class BulkCreate<T> extends BulkBase<T> {
    public constructor(doc: IBulkBase<T>, resolver: Function, rejecter: Function) {
        super(doc, resolver, rejecter, "create", {});
    }

    protected toBulk(obj: IBulkBase<T>): BulkType<T>[] {
        return [
            {
                create: {
                    _index: obj.index,
                    _id: obj.id,
                },
            },
            obj.doc,
        ];
    }
}

export class BulkUpdate<T> extends BulkBase<T, {crear: boolean}> {
    public constructor(doc: IBulkBase<T>, resolver: Function, rejecter: Function, crear: boolean) {
        super(doc, resolver, rejecter, "update", {crear});
    }

    protected toBulk(obj: IBulkBase<T>): BulkType<T>[] {
        return [
            {
                update: {
                    _index: obj.index,
                    _id: obj.id,
                },
            },
            {
                doc: obj.doc,
                doc_as_upsert: this.settings.crear,
            },
        ];
    }
}

export class BulkDelete extends BulkBase {
    public constructor(doc: IBulkBase<void>, resolver: Function, rejecter: Function) {
        super(doc, resolver, rejecter, "delete", {});
    }

    protected toBulk(obj: IBulkBase<void>): BulkType<void>[] {
        return [
            {
                delete: {
                    _index: obj.index,
                    _id: obj.id,
                },
            },
        ];
    }
}

export class BulkScript extends BulkBase<Script> {
    public constructor(doc: IBulkBase<Script>, resolver: Function, rejecter: Function) {
        super(doc, resolver, rejecter, "update", {});
    }

    protected toBulk(obj: IBulkBase<Script>): BulkType<Script>[] {
        return [
            {
                update: {
                    _index: obj.index,
                    _id: obj.id,
                    retry_on_conflict: 100,
                },
            },
            {
                script: obj.doc,
            },
        ];
    }
}
