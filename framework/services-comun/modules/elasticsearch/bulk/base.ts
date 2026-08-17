/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: 76c7680af352f9f1b1c76597c905cbbb
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {BulkError} from "./error";
import {
    BulkOperation,
    BulkOperationCreate,
    BulkOperationDelete,
    BulkOperationIndex,
    BulkOperationScript,
    BulkOperationUpdate,
} from "./operation";
import {Elasticsearch, Refresh, Script} from "..";

/**
 * Configuración con la que se instancia {@link BulkBase} (y sus subclases {@link "./index.ts".Bulk}
 * / {@link "./auto.ts".BulkAuto}).
 *
 * @property blockSize - Tamaño de bloque en el que se agrupan las operaciones al enviarlas.
 * @property index - Índice por defecto para las operaciones que no indiquen uno propio.
 * @property refresh - Política de refresh de Elasticsearch a aplicar en cada petición bulk.
 */
export interface BulkConfig {
    blockSize?: number;
    index?: string;
    refresh?: Refresh;
}

interface IBulkParams {
    index?: string;
    id?: string;
}

/** Parámetros de una operación que requiere el id del documento (`update`/`delete`/`script`). */
export interface IBulkParamsID extends IBulkParams {
    id: string;
}

/** Parámetros de una operación que aporta el documento completo (`create`/`index`). */
export interface IBulkParamsDoc<T> extends IBulkParams {
    doc: T;
}

/**
 * Parámetros de una actualización mediante script.
 *
 * @property doc - Documento a insertar (`upsert`) si el documento no existe todavía.
 */
export interface IBulkParamsScript<T> extends IBulkParamsID {
    script: Script;
    doc?: T;
}

/**
 * Parámetros de una operación `update`.
 *
 * @property crear - Si `true`, crea el documento (`doc_as_upsert`) cuando no existe.
 * @property upsert - Documento a insertar si no existe; sustituye a `doc_as_upsert` cuando se indica.
 * @property retry_on_conflict - Número de reintentos que hace Elasticsearch ante un conflicto de versión.
 */
export interface IBulkParamsUpdate<T> extends IBulkParamsID {
    doc: Partial<T>;
    crear?: boolean;
    upsert?: T;
    retry_on_conflict?: number;
}

/**
 * Acumula operaciones de escritura ({@link create}/{@link index}/{@link update}/{@link delete}/
 * {@link script}) en `operaciones`, sin enviarlas: el envío real (y su política de reintentos)
 * lo implementan las subclases {@link "./index.ts".Bulk} (envío puntual) y {@link "./auto.ts".BulkAuto}
 * (envío periódico automático).
 */
export abstract class BulkBase {
    /* STATIC */

    /* INSTANCE */
    protected readonly config: BulkConfig;
    protected readonly operaciones: BulkOperation[];

    protected constructor(protected elastic: Elasticsearch, config: BulkConfig) {
        this.config = config;
        this.operaciones = [];
    }

    /** Resuelve el índice a usar: el indicado, o si no se indica, el de {@link BulkConfig.index}. Falla si ninguno está definido. */
    protected checkOperacion(index?: string): string {
        index ??= this.config.index;
        if (index==undefined) {
            throw new BulkError("Index is required");
        }

        return index;
    }

    protected push(op: BulkOperation): BulkOperation {
        this.operaciones.push(op);

        return op;
    }

    /** Encola una operación `create` (falla si el documento ya existe). */
    public create<T extends object>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation {
        return this.push(BulkOperationCreate.build(this.checkOperacion(index), doc, id));
    }

    /** Encola una operación `delete` por id. */
    public delete({index, id}: IBulkParamsID): BulkOperation {
        return this.push(BulkOperationDelete.build(this.checkOperacion(index), id));
    }

    /** Encola una operación `index` (crea el documento o lo reemplaza por completo si ya existe). */
    public index<T extends object>({index, id, doc}: IBulkParamsDoc<T>): BulkOperation {
        return this.push(BulkOperationIndex.build(this.checkOperacion(index), doc, id));
    }

    /** Encola una actualización mediante script. */
    public script<T extends object|undefined>({index, id, script, doc}: IBulkParamsScript<T>): BulkOperation {
        return this.push(BulkOperationScript.build(this.checkOperacion(index), id, script, doc));
    }

    /** Encola una operación `update` sobre un documento existente. */
    public update<T extends object>({index, id, doc, crear, upsert, retry_on_conflict}: IBulkParamsUpdate<T>): BulkOperation {
        return this.push(BulkOperationUpdate.build(this.checkOperacion(index), id, doc, crear, upsert, retry_on_conflict));
    }
}
