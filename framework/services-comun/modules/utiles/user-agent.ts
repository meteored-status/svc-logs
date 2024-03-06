import {isBot as isBotBase} from "../net/utiles";
import {Conexion} from "../net/conexion";

export const isBot = (conexion: Conexion): boolean => {
    return isBotBase(conexion.userAgent??'');
}
