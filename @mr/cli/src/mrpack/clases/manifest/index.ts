import {readJSON, readJSONSync, safeWrite} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import type {ManifestRoot} from "../../../../manifest";

type ManifestDefault<T> = {DEFAULT: T};
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
        this.manifest = new Manifest(this.defecto.DEFAULT);

        this.file = ManifestLoader.getFile(basedir);
        this.guardando = false;
    }

    public abstract check(manifest?: Partial<T>): T;

    public async load(): Promise<ManifestLoader<T, K>> {
        const guardar = await readJSON<Partial<T>>(this.file)
            .then((manifest) => {
                const hash_inicial = md5(JSON.stringify(manifest));
                const manifest_final = this.check(manifest);
                const hash_final = md5(JSON.stringify(manifest_final));

                this.manifest = new this.Manifest(manifest_final);

                return hash_inicial!=hash_final;
            })
            .catch(() => {
                this.manifest = new this.Manifest(this.defecto.DEFAULT);
                return true;
            });
        if (guardar) {
            await this.save();
        }

        return this;
    }

    public loadSync(): ManifestLoader<T, K> {
        const salida = readJSONSync<Partial<T>>(this.file);
        if (salida!=null) {
            this.manifest = new this.Manifest(this.check(salida));
        } else {
            this.manifest = new this.Manifest(this.defecto.DEFAULT);
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

    public toJSON(): T {
        return this.manifest.toJSON();
    }
}
