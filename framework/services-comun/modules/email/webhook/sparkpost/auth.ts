/**
 * Editor: Fran García
 * Fecha: Fri, 19 Jun 2026 07:29:05 GMT
 * Hash: fc78aab80742540eef1430e61bb5bdc3
 * Versión: 2026.6.19+1-frangarcia
 */

import {readJSONSync} from "../../../utiles/fs";
import {Conexion} from "@mr/core-network/server/http/conexion";

interface ICredenciales {
    username: string;
    password: string;
}

export class Auth {

    /* STATIC */
    private static credenciales: ICredenciales = readJSONSync<ICredenciales>('files/credenciales/webhook-sp.json') as ICredenciales;

    /* INSTANCE */
    public constructor() {
    }

    public authenticate(conexion: Conexion): boolean {
        const auth = conexion.getHeaders().authorization;
        if (auth==undefined) {
            return false;
        }
        const [username, password] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        return username===Auth.credenciales.username && password===Auth.credenciales.password;
    }
}

const auth: Auth = new Auth();
export default auth;
