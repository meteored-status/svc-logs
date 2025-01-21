import type {BulkOperationContainer, ESBulkOperation, Script} from "..";
import {Deferred} from "../../utiles/promise";

abstract class BulkOperation extends Deferred {
    /* INSTANCE */
    protected constructor(protected op: BulkOperationContainer) {
        super();
    }

    public get operations(): ESBulkOperation<any>[] {
        return [
            this.op,
        ];
    }
}
export {type BulkOperation};

abstract class BulkOperationDoc<T> extends BulkOperation {
    /* INSTANCE */
    protected constructor(op: BulkOperationContainer, protected doc: T) {
        super(op);
    }

    public override get operations(): ESBulkOperation<any>[] {
        return [
            this.op,
            this.doc,
        ];
    }
}

export class BulkOperationCreate<T extends object> extends BulkOperationDoc<T> {
    /* STATIC */
    public static build<T extends object>(index: string, doc: T, id?: string): BulkOperationCreate<T> {
        return new this<T>(index, doc, id);
    }

    /* INSTANCE */
    private constructor(index: string, doc: T, id?: string) {
        super({
            create: {
                _index: index,
                _id: id,
            },
        }, doc);
    }
}

export class BulkOperationDelete extends BulkOperation {
    /* STATIC */
    public static build(index: string, id: string): BulkOperationDelete {
        return new this(index, id);
    }

    /* INSTANCE */
    private constructor(index: string, id: string) {
        super({
            delete: {
                _index: index,
                _id: id,
            },
        });
    }
}

export class BulkOperationIndex<T extends object> extends BulkOperationDoc<T> {
    /* STATIC */
    public static build<T extends object>(index: string, doc: T, id?: string): BulkOperationIndex<T> {
        return new this<T>(index, doc, id);
    }

    /* INSTANCE */
    private constructor(index: string, doc: T, id?: string) {
        super({
            index: {
                _index: index,
                _id: id,
            },
        }, doc);
    }
}

export class BulkOperationScript<T extends object|undefined> extends BulkOperationDoc<T|undefined> {
    /* STATIC */
    public static build<T extends object|undefined>(index: string, id: string, script: Script, doc?: T): BulkOperationScript<T> {
        return new this(index, id, script, doc);
    }

    /* INSTANCE */
    private constructor(index: string, id: string, protected script: Script, doc?: T) {
        super({
            update: {
                _index: index,
                _id: id,
                retry_on_conflict: 100,
            },
        }, doc);
    }

    public override get operations(): ESBulkOperation<T|undefined>[] {
        return [
            this.op,
            {
                script: this.script,
                upsert: this.doc,
            },
        ];
    }
}

export class BulkOperationUpdate<T extends object> extends BulkOperationDoc<Partial<T>> {
    /* STATIC */
    public static build<T extends object>(index: string, id: string, doc: Partial<T>, crear=false, upsert?: T): BulkOperationUpdate<T> {
        return new this<T>(index, id, doc, crear, upsert);
    }

    /* INSTANCE */
    protected documento: ESBulkOperation<T>;

    private constructor(index: string, id: string, doc: Partial<T>, private crear=false, private upsert?: T) {
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
