import type {BulkOperationContainer, ESBulkOperation, Script} from "..";
import {Deferred} from "../../utiles/promise";

export abstract class BulkOperation<T=void> extends Deferred {
    /* INSTANCE */
    protected constructor(protected op: BulkOperationContainer) {
        super();
    }

    public get operations(): ESBulkOperation<T>[] {
        return [
            this.op,
        ];
    }
}

abstract class BulkOperationDoc<T> extends BulkOperation<T> {
    /* INSTANCE */
    protected constructor(op: BulkOperationContainer, protected doc: T) {
        super(op);
    }

    public override get operations(): ESBulkOperation<T>[] {
        return [
            this.op,
            this.doc,
        ];
    }
}

export class BulkOperationCreate<T> extends BulkOperationDoc<T> {
    /* INSTANCE */
    public constructor(index: string, doc: T, id?: string) {
        super({
            create: {
                _index: index,
                _id: id,
            },
        }, doc);
    }
}

export class BulkOperationDelete extends BulkOperation<void> {
    /* INSTANCE */
    public constructor(index: string, id: string) {
        super({
            create: {
                _index: index,
                _id: id,
            },
        });
    }
}

export class BulkOperationIndex<T> extends BulkOperationDoc<T> {
    /* INSTANCE */
    public constructor(index: string, doc: T, id?: string) {
        super({
            index: {
                _index: index,
                _id: id,
            },
        }, doc);
    }
}

export class BulkOperationScript extends BulkOperation<void> {
    /* INSTANCE */
    public constructor(index: string, id: string, protected script: Script) {
        super({
            update: {
                _index: index,
                _id: id,
                retry_on_conflict: 100,
            },
        });
    }

    public override get operations(): ESBulkOperation[] {
        return [
            this.op,
            {
                script: this.script,
            },
        ];
    }
}

export class BulkOperationUpdate<T> extends BulkOperationDoc<Partial<T>> {
    /* INSTANCE */
    protected documento: ESBulkOperation<T>;

    public constructor(index: string, id: string, doc: Partial<T>, private crear=false, private upsert?: T) {
        super({
            update: {
                _index: index,
                _id: id,
            },
        }, doc);
        if (!this.crear) {
            this.documento = {
                doc: this.doc,
            };
        } else if (this.upsert==undefined) {
            this.documento = {
                doc: this.doc,
                doc_as_upsert: true,
            };
        } else {
            this.documento = {
                doc: this.doc,
                upsert: this.upsert,
            };
        }
    }

    public override get operations(): ESBulkOperation<T>[] {
        return [
            this.op,
            this.documento,
        ];
    }
}
