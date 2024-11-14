import chokidar, {type FSWatcher} from "chokidar";

export interface IWorkspace {
    nombre: string;
    path?: string;
    root: string;
}

export class Workspace {
    /* STATIC */

    /* INSTANCE */
    protected readonly nombre: string;
    protected readonly root: string;
    protected readonly dir: string;
    protected readonly hijos: Workspace[];

    protected iniciado: boolean;
    protected watcher?: FSWatcher;

    public constructor(data: IWorkspace) {
        this.nombre = data.nombre;
        this.root = data.root;
        this.dir = data.path!=undefined ? `${data.root}/${data.path}/${data.nombre}` : `${data.root}/${data.nombre}`;
        this.hijos = [];

        this.iniciado = false;
    }

    public addHijo(ws: Workspace): void {
        this.hijos.push(ws);
    }

    public async init(): Promise<void> {
        if (this.iniciado) {
            return;
        }
        this.iniciado = true;

        await this.run();

        this.initWatcher();
    }

    public parar(): void {
        this.watcher?.close();
    }

    protected initWatcher(): void {
        this.parar();
        // if (os.platform()!="linux") {
        this.watcher = chokidar.watch(this.dir, {
            persistent: true,
            ignored: (path)=>path.endsWith("~"),
        }).on("change", () => {
            this.cambio();
        });
        // }
    }

    public cambio(): void {
        for (const actual of this.hijos) {
            actual.cambio();
        }
    }

    protected async run(): Promise<void> {

    }
}
