import {MySQL} from "../../../modules/database/mysql";

const db = MySQL.build({credenciales: `i18n/.credenciales/mysql.json`});
export default db;
