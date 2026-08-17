/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: 9c424a1c4f3e2fab26feb0bbf4374c1a
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import type {BulkOperationContainer, ESBulkOperation, Script} from "..";
import {Deferred} from "../../utiles/promise";

/**
 * Operación individual encolada en {@link "./base.ts".BulkBase}. Extiende directamente
 * {@link Deferred} (en vez de envolver una): así cada operación *es* la promesa que se resuelve
 * o rechaza cuando {@link "./index.ts".Bulk} procesa el item de la respuesta que le corresponde.
 */
abstract class BulkOperation extends Deferred {
    /* INSTANCE */
    protected constructor(protected op: BulkOperationContainer) {
        super();
    }

    /** Líneas que aporta esta operación al array `operations` de una petición bulk. */
    public get operations(): ESBulkOperation<any>[] {
        return [
            this.op,
        ];
    }

    /** Tamaño en bytes de esta operación serializada, usado solo para logging. */
    public get size(): number {
        return JSON.stringify(this.operations).length;
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

/** Operación `create`: crea el documento, fallando si ya existe uno con el mismo id. */
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

/** Operación `delete`: elimina el documento por id. */
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

/** Operación `index`: crea el documento o lo reemplaza por completo si ya existe. */
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

/** Operación de actualización mediante script, con `retry_on_conflict` alto para tolerar updates concurrentes. Su respuesta llega bajo la clave `update`. */
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

/**
 * Operación `update`: actualiza parcialmente el documento. Sin `upsert`, si `crear` es `true` usa
 * `doc_as_upsert` (inserta el propio `doc` si no existe); con `upsert`, inserta ese documento
 * completo en su lugar cuando no existe.
 */
export class BulkOperationUpdate<T extends object> extends BulkOperationDoc<Partial<T>> {
    /* STATIC */
    public static build<T extends object>(index: string, id: string, doc: Partial<T>, crear=false, upsert?: T, retry_on_conflict?: number): BulkOperationUpdate<T> {
        return new this<T>(index, id, doc, crear, upsert, retry_on_conflict);
    }

    /* INSTANCE */
    protected documento: ESBulkOperation<T>;

    private constructor(index: string, id: string, doc: Partial<T>, private crear=false, private upsert?: T, retry_on_conflict?: number) {
        super({
            update: {
                _index: index,
                _id: id,
                retry_on_conflict
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
