/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 02 Jul 2026 11:35:20 GMT
 * Hash: 2943cfc20f742dfc284bc59bdc61c977
 * Versión: 2026.7.2+4-josantoniojimnez
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import type {ManifestRoot} from "@mr/core-dev/manifest/root";
import {readJSON, readJSONSync, safeWrite} from "services-comun/modules/utiles/fs";
import {md5} from "services-comun/modules/utiles/hash";

import type {IPackageJsonLegacy} from "../packagejson";

type ManifestDefault<T> = {default: T};
type ManifestLoad<T, K extends ManifestRoot<T>> = new (manifest: T)=>K;

/**
 * Cargador base de manifests `mrpack.json`.
 * Gestiona la lectura, normalización, persistencia y aplicación de variables de entorno
 * para cualquier tipo de manifest del monorepo.
 */
export abstract class ManifestLoader<T, K extends ManifestRoot<T>> {
    /* STATIC */
    /**
     * Devuelve la ruta absoluta del fichero `mrpack.json` de un directorio.
     *
     * @param basedir - Directorio del workspace o raíz del monorepo.
     * @returns Ruta absoluta al fichero `mrpack.json`.
     */
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

    /**
     * Normaliza y valida un manifest parcial, completando los valores no presentes con los defaults.
     * Implementado por cada loader concreto.
     *
     * @param manifest - Datos parciales leídos del `mrpack.json`.
     * @param paquete  - Package.json legacy del workspace, usado en la normalización si es necesario.
     * @returns Objeto de manifest completo y normalizado.
     */
    public abstract check(manifest?: Partial<T>, paquete?: IPackageJsonLegacy): T;

    /**
     * Carga el manifest desde disco de forma asíncrona.
     * Si el fichero no existe, inicializa con los valores por defecto y guarda.
     * Si el contenido normalizado difiere del original, persiste los cambios.
     *
     * @param env     - Si `true`, aplica las variables de entorno al manifest tras cargarlo.
     * @param paquete - Package.json legado del workspace, usado en la normalización.
     * @returns La propia instancia del loader para encadenar llamadas.
     */
    public async load(env: boolean = false, paquete?: IPackageJsonLegacy): Promise<ManifestLoader<T, K>> {
        const guardar = await readJSON<Partial<T>>(this.file)
            .then((manifest) => {
                const hashInicial = md5(JSON.stringify(manifest));
                this.manifest = new this.Manifest(this.check(manifest, paquete));
                const hashFinal = md5(JSON.stringify(this.manifest));

                return hashInicial!==hashFinal;
            })
            .catch((err) => {
                if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
                    // El fichero existe pero no es JSON válido (p. ej. edición manual en curso):
                    // no se resetea a los valores por defecto ni se sobrescribe el fichero.
                    return Promise.reject(err);
                }
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

    /**
     * Carga el manifest desde disco de forma síncrona.
     * Si el fichero no existe o falla la lectura, usa los valores por defecto.
     *
     * @param paquete - Package.json legado del workspace, usado en la normalización.
     * @returns La propia instancia del loader para encadenar llamadas.
     */
    public loadSync(paquete?: IPackageJsonLegacy): ManifestLoader<T, K> {
        const salida = readJSONSync<Partial<T>>(this.file);
        if (salida!=null) {
            this.manifest = new this.Manifest(this.check(salida, paquete));
        } else {
            this.manifest = new this.Manifest(this.defecto.default);
        }

        return this;
    }

    /**
     * Persiste el manifest actual en disco como JSON indentado.
     * Ignora llamadas concurrentes si ya hay una escritura en curso.
     *
     */
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

    /**
     * Serializa el manifest actual a su representación JSON bruta.
     *
     * @returns Objeto JSON del manifest.
     */
    public toJSON(): T {
        return this.manifest.toJSON();
    }
}
