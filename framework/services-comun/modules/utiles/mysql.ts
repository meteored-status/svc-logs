import {MySQL} from "../database/mysql";

const db = MySQL.build(`files/credenciales/mysql.json`);
export default db;
