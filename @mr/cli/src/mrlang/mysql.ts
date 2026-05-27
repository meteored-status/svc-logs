/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: d1167a874abffc0098fc4165e1532488
 */

import {MySQL} from "services-comun/modules/database/mysql";

const db = MySQL.build({credenciales: `i18n/.credenciales/mysql.json`});
export default db;
