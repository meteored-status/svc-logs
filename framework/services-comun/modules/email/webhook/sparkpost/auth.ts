/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 01becdbd2e2c893ea5983d59a8678d53
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.6.19+1-frangarcia
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Conexion} from "@mr/core-network/server/http/conexion";

import {readJSONSync} from "../../../utiles/fs";

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
