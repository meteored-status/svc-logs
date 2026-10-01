/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: d0253db2672394f05c3a81ee57056d47
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.6.16+1-juancmartinez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IPostgreSQLBuild, IPostgreSQLConnectionOptions} from "../postgresql";
import {PostgreSQL} from "../postgresql";

interface IAlloyDBConnectionOptions extends IPostgreSQLConnectionOptions {
}

interface IAlloyDBBuild extends IPostgreSQLBuild {
}

export class AlloyDB extends PostgreSQL {
    /* STATIC */

    public static override build({credenciales=`files/credenciales/alloydb.json`, database=DATABASE, options}: IAlloyDBBuild={}): AlloyDB {
        return super.build({credenciales, database, options});
    }

    /* INSTANCE */
    protected constructor(credenciales: string, database?: string, options?: IAlloyDBConnectionOptions) {
        super(credenciales, database, options);
    }

}
