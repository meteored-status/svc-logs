/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 16 Jun 2026 06:54:00 GMT
 * Hash: 590c755f121f603d967313fdc326c968
 * Versión: 2026.6.16+1-juancmartinez
 */

import {PostgreSQL} from "../database/postgresql";

await using db = PostgreSQL.build();
export default db;
