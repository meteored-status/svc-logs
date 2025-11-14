import {IPostgreSQLBuild, PostgreSQL} from "../postgresql";

interface IAlloyDBBuild extends IPostgreSQLBuild {
}

export class AlloyDB extends PostgreSQL {
    /* STATIC */

    public static override build({credenciales=`files/credenciales/alloydb.json`, database=DATABASE}: IAlloyDBBuild={}): AlloyDB {
        return super.build({credenciales, database});
    }

    /* INSTANCE */
    protected constructor(credenciales: string, database?: string) {
        super(credenciales, database);
    }

}
