import {readJSONSync} from "../../../utiles/fs";
import {Conexion} from "../../../net/conexion";

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
