import {readJSON, readJSONSync, safeWrite} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import type {ManifestRoot} from "../../../../manifest";
import type {IPackageJsonLegacy} from "../packagejson";

type ManifestDefault<T> = {default: T};
type ManifestLoad<T, K extends ManifestRoot<T>> = new (manifest: T)=>K;

export abstract class ManifestLoader<T, K extends ManifestRoot<T>> {
    /* STATIC */
    public static getFile(basedir: string): string {
        return `${basedir}/mrpack.json`;
    }

    /* INSTANCE */
    public manifest: K;

    protected readonly file: string;
    protected guardando: boolean;

    protected constructor(basedir: string, protected readonly Manifest: ManifestLoad<T, K>, protected readonly defecto: ManifestDefault<T>) {
        this.manifest = new Manifest(this.defecto.default);

        this.file = ManifestLoader.getFile(basedir);
        this.guardando = false;
    }

    public abstract check(manifest?: Partial<T>, paquete?: IPackageJsonLegacy): T;

    public async load(env: boolean = false, paquete?: IPackageJsonLegacy): Promise<ManifestLoader<T, K>> {
        const guardar = await readJSON<Partial<T>>(this.file)
            .then((manifest) => {
                const hashInicial = md5(JSON.stringify(manifest));
                this.manifest = new this.Manifest(this.check(manifest, paquete));
                const hashFinal = md5(JSON.stringify(this.manifest));

                return hashInicial!==hashFinal;
            })
            .catch(() => {
                this.manifest = new this.Manifest(this.defecto.default);
                return true;
            });
        if (guardar) {
            await this.save();
        }

        if (env) {
            this.applyENV();
        }

        return this;
    }

    public loadSync(paquete?: IPackageJsonLegacy): ManifestLoader<T, K> {
        const salida = readJSONSync<Partial<T>>(this.file);
        if (salida!=null) {
            this.manifest = new this.Manifest(this.check(salida, paquete));
        } else {
            this.manifest = new this.Manifest(this.defecto.default);
        }

        return this;
    }

    public async save(): Promise<void> {
        if (this.guardando) {
            return;
        }
        this.guardando = true;
        try {
            await safeWrite(this.file, JSON.stringify(this.toJSON(), null, 4), true);
        } catch (err) {
            console.log("Error guardando manifest", err);
        } finally {
            this.guardando = false;
        }
    }

    public abstract applyENV(): void;

    public toJSON(): T {
        return this.manifest.toJSON();
    }
}
