import {Checker} from "./checkers";
import {Conexion} from "./conexion";
import {RouteGroup, RouteGroupError} from "./routes/group";

export class Routes {
    public constructor(private groups: RouteGroup[], public readonly error: RouteGroupError) {
    }

    public getDocumentables(): Checker[] {
        const salida: Checker[] = [];

        for (const grupo of this.groups) {
            if (!grupo.params.documentable) {
                continue;
            }
            salida.push(...grupo.getDocumentables());
        }
        return salida.sort((a, b) => {
            if (a.resumen < b.resumen) {
                return -1;
            }
            if (a.resumen > b.resumen) {
                return 1;
            }
            return 0;
        });
    }

    public async check(conexion: Conexion): Promise<boolean> {
        for (const grupo of this.groups) {
            if (await grupo.check(conexion)) {
                return true;
            }
        }

        return false;
    }
}
