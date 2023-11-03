import {Conexion} from "./conexion";

export type TStatus = 301|404|410|500;

export abstract class Error {
    /* STATIC */

    /* INSTANCE */
    protected constructor(public readonly status: TStatus) {
    }

    public abstract sendRespuesta(conexion: Conexion): Promise<number>;
}


export class Error301 extends Error {
    /* STATIC */
    public static build(location: string): Error301 {
        return new this(301, location);
    }

    /* INSTANCE */
    protected constructor(status: TStatus, public readonly location: string) {
        super(status);
    }

    public async sendRespuesta(conexion: Conexion): Promise<number> {
        return conexion.send301(this.location);
    }
}


export class Error404 extends Error {
    /* STATIC */
    public static build(message: string, extra?: any): Error404 {
        return new this(404, message, extra);
    }

    /* INSTANCE */
    protected constructor(status: TStatus, public readonly message: string, public readonly extra?: any) {
        super(status);
    }

    public async sendRespuesta(conexion: Conexion): Promise<number> {
        return conexion.error(this.status, this.message, this.extra);
    }
}


export class Error410 extends Error404 {
    /* STATIC */
    public static override build(message: string, extra?: any): Error410 {
        return new this(410, message, extra);
    }

    /* INSTANCE */
}


export class Error500 extends Error404 {
    /* STATIC */
    public static override build(message: string, extra?: any): Error500 {
        return new this(500, message, extra);
    }

    /* INSTANCE */
}
