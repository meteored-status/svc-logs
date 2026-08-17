/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: 825a1c1d423e73fce6ef26e045a30506
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {BulkOperationContainer, BulkResponseItem, BulkUpdateAction, ESBulkResponse, Script} from "..";

type TBulkAction = "index"|"update"|"delete"|"create";

/** Línea (metadatos, o metadatos+documento) que aporta una operación al array `operations` de un bulk. */
export type BulkType<T> = (BulkOperationContainer | BulkUpdateAction<T, Partial<T>> | T);

/**
 * Datos de una operación a encolar en {@link Bulk}.
 *
 * @property index - Índice sobre el que actúa la operación.
 * @property id - Id del documento. Requerido para `update`/`delete`/`script`; opcional en `index`/`create` (Elasticsearch genera uno si se omite).
 * @property doc - Documento (o script, para {@link BulkScript}) asociado a la operación.
 */
export interface IBulkBase<T> {
    index: string;
    id?: string;
    doc: T;
}

/**
 * Operación individual en cola de {@link Bulk}: sabe convertirse a las 1-2 líneas que le
 * corresponden dentro del array `operations` de una petición bulk, e interpretar el item de la
 * respuesta que le corresponde para resolver/rechazar la promesa de quien la encoló.
 */
export abstract class BulkBase<T=void, C={}> {
    public readonly bulk: BulkType<T>[];

    protected constructor(obj: IBulkBase<T>, private resolver: (data: BulkResponseItem)=>void, private rejecter: (reason?: BulkResponseItem)=>void, private accion: TBulkAction, protected settings: C) {
        this.bulk = this.toBulk(obj);
    }

    public resolve(data: BulkResponseItem): void {
        this.resolver(data);
    }

    public reject(reason?: BulkResponseItem): void {
        this.rejecter(reason);
    }

    /**
     * Interpreta el item de la respuesta de bulk que corresponde a esta operación (buscado por
     * su `accion`) y resuelve o rechaza la promesa de quien la encoló en consecuencia.
     */
    public end(data: ESBulkResponse): boolean {
        const resultado = data[this.accion];
        if (resultado!==undefined) {
            if (resultado.error===undefined) {
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

/** Operación `index`: crea el documento o lo reemplaza por completo si ya existe. */
export class BulkIndex<T> extends BulkBase<T> {
    public constructor(doc: IBulkBase<T>, resolver: (data: BulkResponseItem)=>void, rejecter: (reason?: BulkResponseItem)=>void) {
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

/** Operación `create`: crea el documento, fallando si ya existe uno con el mismo id. */
export class BulkCreate<T> extends BulkBase<T> {
    public constructor(doc: IBulkBase<T>, resolver: (data: BulkResponseItem)=>void, rejecter: (reason?: BulkResponseItem)=>void) {
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

/** Operación `update`: actualiza parcialmente el documento; si `crear` es `true`, lo crea (`doc_as_upsert`) cuando no existe. */
export class BulkUpdate<T> extends BulkBase<T, {crear: boolean}> {
    public constructor(doc: IBulkBase<T>, resolver: (data: BulkResponseItem)=>void, rejecter: (reason?: BulkResponseItem)=>void, crear: boolean) {
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

/** Operación `delete`: elimina el documento por id. */
export class BulkDelete extends BulkBase {
    public constructor(doc: IBulkBase<void>, resolver: (data: BulkResponseItem)=>void, rejecter: (reason?: BulkResponseItem)=>void) {
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

/** Operación de actualización mediante script, con `retry_on_conflict` alto para tolerar updates concurrentes sobre el mismo documento. Su respuesta llega bajo la clave `update`. */
export class BulkScript extends BulkBase<Script> {
    public constructor(doc: IBulkBase<Script>, resolver: (data: BulkResponseItem)=>void, rejecter: (reason?: BulkResponseItem)=>void) {
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
