import {Conexion} from "./conexion";
import {RouteGroup, RouteGroupError} from "./routes/group";

export class Routes {
    private readonly cantidad:number;

    public constructor(private groups: RouteGroup[], public readonly error: RouteGroupError) {
        this.cantidad = groups.length;
    }

    public async check(conexion: Conexion): Promise<boolean> {
        for (const grupo of this.groups) {
            if (await grupo.check(conexion)) {
                return true;
            }
        }
        // for (let i=0; i<this.cantidad; i++) {
        //     if (await this.groups[i].check(conexion)) {
        //         return true;
        //     }
        // }

        return false;
    }
}
