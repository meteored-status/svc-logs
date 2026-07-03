/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 16 Jun 2026 06:54:00 GMT
 * Hash: 72fc0057dd11feb3eca32063a3118ecf
 * Versión: 2026.6.16+1-juancmartinez
 */

import {IPostgreSQLBuild, IPostgreSQLConnectionOptions, PostgreSQL} from "../postgresql";

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
