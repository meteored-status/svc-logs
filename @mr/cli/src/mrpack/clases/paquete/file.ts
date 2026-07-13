/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 6ca3e27806532c552b6a9c4695c6c90f
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.7.3+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import type JSZip from "jszip";
import path from "node:path";

import {Fecha} from "services-comun/modules/utiles/fecha";
import {md5} from "services-comun/modules/utiles/hash";

import {isFile, mkdir, readFile, readFileString, safeWrite, unlink} from "../../../utiles/fs";
import {PaqueteDirectory} from "./directory";
import merge3, {type IConflictoBloque} from "../../utiles/merge";

const PACKAGE_JSON_PRIORIDAD = ["name", "description", "author", "scripts", "bin", "config"];

/**
 * Patrón que identifica el bloque de autoría al inicio de un fichero `.ts`.
 * Se excluye del cálculo del hash para que actualizar el comentario
 * (fecha, autor) no genere un hash diferente y evitar así falsos positivos en
 * los pushes sucesivos.
 */
const PATRON_AUTORIA = /^\/\*\*\n \* Editor: [^\n]*\n \* Fecha: [^\n]*\n(?: \* Hash: [^\n]*\n)?(?: \* Versión: [^\n]*\n)?(?: \* Anterior: [^\n]*\n)?(?: \* Proyecto: [^\n]*\n)? \*\/\n\n/;

const PATRON_VERSION_BLOQUE = /^ \* Versión: ([^\n]+)$/m;

/**
 * Elimina todos los bloques de autoría consecutivos del inicio del contenido.
 * Puede haber más de uno si un push anterior inyectó un bloque encima de otro
 * que aún no había sido limpiado.
 *
 * @param contenido - Texto completo del fichero `.ts`.
 * @returns Texto sin los bloques de autoría iniciales.
 */
export function stripAutoria(contenido: string): string {
    let resultado = contenido;
    while (PATRON_AUTORIA.test(resultado)) {
        resultado = resultado.replace(PATRON_AUTORIA, "");
    }
    return resultado;
}

function normalizarJSON(obj: unknown, prioridad: string[] = []): unknown {
    if (Array.isArray(obj)) {
        return obj.map(item => normalizarJSON(item));
    }
    if (obj !== null && typeof obj === "object") {
        const entrada = obj as Record<string, unknown>;
        const resultado: Record<string, unknown> = {};
        for (const key of prioridad) {
            if (key in entrada) {
                resultado[key] = normalizarJSON(entrada[key]);
            }
        }
        for (const key of Object.keys(entrada).sort()) {
            if (!prioridad.includes(key)) {
                resultado[key] = normalizarJSON(entrada[key]);
            }
        }
        return resultado;
    }
    return obj;
}

export interface IPaqueteFile {
    autor: string;
    fecha: string;
    hash: string;
}
export interface PaqueteFileFiles {
    status?: PaqueteFile;
    files: {[key: string]: JSZip.JSZipObject};
}

/**
 * Una entrada por cada fichero afectado por una actualización.
 *
 * @property archivo    - Ruta relativa del fichero.
 * @property estado     - `"error"` cuando el merge 3-way produjo conflicto, `"ok"` en cualquier otro caso.
 * @property conflictos - Detalle de las secciones en conflicto (solo presente cuando `estado === "error"`).
 */
export interface IEntradaActualizacion {
    archivo: string;
    estado: "ok" | "error";
    conflictos?: IConflictoBloque[];
}

/**
 * Tracker mutable que fluye por el árbol de ficheros durante `actualizarVersion`.
 *
 * @property hayConflictos - Se pone a `true` en cuanto algún fichero produce conflicto en el merge 3-way.
 * @property entradas      - Una entrada por cada fichero afectado por la actualización (borrado, sobreescrito o mezclado).
 */
export interface IUpdateTracker {
    hayConflictos: boolean;
    entradas: IEntradaActualizacion[];
}

/**
 * Representa un fichero dentro de un paquete mrpack.
 * Gestiona el cálculo de hash, la inyección de bloques de autoría,
 * la mezcla 3-way con diff3 y la aplicación de actualizaciones desde ZIP.
 */
export class PaqueteFile {
    /* STATIC */
    public static get DEFECTO(): IPaqueteFile {
        return {
            autor: "mr-cli",
            fecha: new Date(0).toISOString(),
            hash: "",
        };
    }

    public static build(nombre: string, path: string, data: IPaqueteFile=this.DEFECTO): PaqueteFile {
        return new this(nombre, path, data);
    }

    /* INSTANCE */
    public autor: string;
    public fecha: Date;
    public hash: string;

    public readonly filename: string;
    public hashCambio: boolean;

    protected constructor(public readonly nombre: string, protected readonly path: string, protected data: IPaqueteFile) {
        this.autor = data.autor;
        this.fecha = new Date(data.fecha);
        this.hash = data.hash;

        this.filename = this.path.length>0 ? `${this.path}/${this.nombre}` : this.nombre;
        this.hashCambio = false;
    }

    public toJSON(): IPaqueteFile {
        return {
            autor: this.autor,
            fecha: Fecha.generarFechaHoraMySQL(this.fecha),
            hash: this.hash,
        };
    }

    public clone(): PaqueteFile {
        return PaqueteFile.build(this.nombre, this.path, this.toJSON());
    }

    /**
     * Recalcula el hash del fichero a partir de los hashes de su contenido.
     * Actualiza `autor`, `fecha` y `hashCambio` si el hash cambia.
     *
     * @param hashes - Hashes de los componentes (contenido, subhashes…).
     * @param autor  - Autor que se registra si el hash cambia.
     * @returns `true` si el hash ha cambiado.
     */
    protected recalcularHash(hashes: string[], autor: string): boolean {
        const hash = md5([this.filename, ...hashes].join(""));
        if (hash===this.hash) {
            return false;
        }

        this.autor = autor;
        this.fecha = new Date();
        this.hash = hash;
        this.hashCambio = true;

        return true;
    }

    /**
     * Inyecta el bloque de autoría al inicio del fichero `.ts` si su hash ha cambiado.
     * El hash se calcula sobre el cuerpo sin el bloque anterior, por lo que es estable.
     *
     * @param basedir  - Raíz absoluta del monorepo.
     * @param autor    - Nombre del autor a estampar.
     * @param version  - Versión del paquete a registrar en el bloque.
     * @param proyecto - URL del repositorio git del proyecto (sin credenciales). Si está vacío, se omite la línea.
     * @returns Hash actualizado del fichero.
     */
    public async inyectarAutoria(basedir: string, autor: string, version: string, proyecto: string): Promise<string> {
        if (!this.nombre.endsWith(".ts") || !this.hashCambio) {
            return this.hash;
        }

        const contenido = await readFileString(`${basedir}/${this.filename}`);
        // Extraer versión anterior del bloque de autoría actual (si existe)
        const matchVersion = PATRON_VERSION_BLOQUE.exec(contenido);
        const versionAnterior = matchVersion?.[1];
        // Extraemos el cuerpo sin TODOS los bloques de autoría anteriores (si los hubiera)
        const cuerpo = stripAutoria(contenido);
        const hashCuerpo = md5(cuerpo);
        const lineaAnterior = versionAnterior !== undefined ? ` * Anterior: ${versionAnterior}\n` : "";
        const lineaProyecto = proyecto.length > 0 ? ` * Proyecto: ${proyecto}\n` : "";
        const comentario = `/**\n * Editor: ${autor}\n * Fecha: ${new Date().toUTCString()}\n * Hash: ${hashCuerpo}\n * Versión: ${version}\n${lineaAnterior}${lineaProyecto} */\n\n`;
        const nuevo = comentario + cuerpo;
        await safeWrite(`${basedir}/${this.filename}`, nuevo, true);
        // El hash se calcula sobre el CUERPO (sin el bloque de autoría) para que sea
        // coherente con lo que calcula update() y no genere falsos positivos en el
        // siguiente push por el mero hecho de que la fecha del comentario haya cambiado.
        this.hash  = md5([this.filename, hashCuerpo].join(""));
        this.autor = autor;

        return this.hash;
    }

    /**
     * Convierte este fichero en un `PaqueteDirectory` vacío (útil cuando el tipo cambia en disco).
     *
     * @returns Nueva instancia de `PaqueteDirectory` con el mismo nombre y ruta.
     */
    public toDirectory(): PaqueteDirectory {
        return PaqueteDirectory.build(this.nombre, this.path, {
            autor: this.autor,
            fecha: this.fecha.toISOString(),
            hash: md5(this.filename),
            hijos: {},
        });
    }

    /**
     * Crea los directorios intermedios necesarios para alojar este fichero.
     *
     * @param basedir - Raíz absoluta del monorepo.
     */
    public async crearPath(basedir: string): Promise<void> {
        await mkdir(path.dirname(`${basedir}/${this.filename}`));
    }

    /**
     * Comprueba si este fichero existe físicamente en disco.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @returns `true` si el fichero existe.
     */
    public async isFile(basedir: string): Promise<boolean> {
        return await isFile(`${basedir}/${this.filename}`);
    }

    /**
     * Lee y devuelve el contenido del fichero en disco.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @returns Contenido del fichero como cadena de texto.
     */
    public async getContents(basedir: string): Promise<string> {
        return readFileString(`${basedir}/${this.filename}`);
    }

    /**
     * Recalcula el hash del fichero leyendo su contenido actual en disco.
     * Para ficheros `.ts` ignora el bloque de autoría antes de calcular el hash.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param autor   - Autor que se registra si el hash cambia.
     * @returns Hash actualizado.
     */
    public async update(basedir: string, autor: string): Promise<string> {
        let contenido = await readFileString(`${basedir}/${this.filename}`).catch(() => "");
        if (this.nombre.endsWith(".ts")) {
            // Excluir todos los bloques de autoría del cálculo del hash para que sea
            // idéntico al hash que almacena inyectarAutoria (basado en el cuerpo real).
            contenido = stripAutoria(contenido);
        }
        this.recalcularHash([md5(contenido)], autor);

        return this.hash;
    }

    /**
     * Añade el fichero al ZIP de empaquetado con máxima compresión DEFLATE.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param zip     - Instancia JSZip donde se añade el fichero.
     */
    public async pack(basedir: string, zip: JSZip): Promise<void> {
        zip.file(this.filename, readFile(`${basedir}/${this.filename}`), {binary: true, compression: "DEFLATE", compressionOptions: {level: 9,}, createFolders: true});
    }

    /**
     * Aplica los cambios de la nueva versión sobre el fichero local usando diff3.
     * Maneja los casos: fichero nuevo, eliminar, sobreescribir y mezclar 3-way.
     *
     * @param basedir  - Raíz absoluta del monorepo.
     * @param padre    - Directorio padre (para eliminar la referencia si se borra el fichero).
     * @param antiguo  - Estado publicado anterior (base del diff3).
     * @param nuevo    - Estado publicado nuevo (target del diff3).
     * @param bin      - Si `true`, el fichero pertenece a un directorio binario: no se mezcla.
     * @param tracker  - Tracker mutable donde se registran los ficheros afectados y conflictos.
     * @returns `true` si el fichero fue modificado.
     */
    public async checkCambios(basedir: string, padre: PaqueteDirectory, antiguo: PaqueteFileFiles, nuevo: PaqueteFileFiles, bin: boolean, tracker?: IUpdateTracker): Promise<boolean> {
        if (antiguo.status===undefined) {
            if (nuevo.status===undefined && bin) {
                // archivo nuevo en directorio binario => eliminar
                await unlink(`${basedir}/${this.filename}`);
                padre.deleteFile(this);
                tracker?.entradas.push({archivo: this.filename, estado: "ok"});
                return true;
            }
            if (nuevo.status===undefined || this.hash==nuevo.status.hash) {
                return false;
            }

            const mezcla = await this.mezclar(basedir, nuevo.files[this.filename]);
            if (mezcla.conflict && tracker) { tracker.hayConflictos = true; }
            tracker?.entradas.push({archivo: this.filename, estado: mezcla.conflict ? "error" : "ok", conflictos: mezcla.conflict ? mezcla.bloques : undefined});
            this.recalcularHash([mezcla.hash], nuevo.status.autor);

            return true;
        }

        if (nuevo.status===undefined) {
            if (this.hash===antiguo.status.hash) {
                // archivo antiguo y sin cambios que se debe borrar => borrar
                await unlink(`${basedir}/${this.filename}`);
                padre.deleteFile(this);
                tracker?.entradas.push({archivo: this.filename, estado: "ok"});
                return true;
            }

            // archivo antiguo y con cambios que se debe borrar => mantener por ahora
            tracker?.entradas.push({archivo: this.filename, estado: "ok"});
            return false;
        }

        if (antiguo.status.hash===nuevo.status.hash) {
            return false;
        }

        if (antiguo.status.hash===this.hash) {
            // el antiguo no se ha cambiado respecto del actual => sobreescribir
            await this.crearPath(basedir);
            await safeWrite(`${basedir}/${this.filename}`, await nuevo.files[this.filename].async("text"), true);
            this.autor = nuevo.status.autor;
            this.fecha = nuevo.status.fecha;
            this.hash = nuevo.status.hash;
            tracker?.entradas.push({archivo: this.filename, estado: "ok"});

            return true;
        }

        if (antiguo.status.hash!==this.hash && nuevo.status.hash!==this.hash) {
            // el antiguo, el actual y el nuevo son diferentes => mezclar
            const mezcla = await this.mezclar(basedir, nuevo.files[this.filename], !bin ? antiguo.files[this.filename] : undefined);
            if (mezcla.conflict && tracker) { tracker.hayConflictos = true; }
            tracker?.entradas.push({archivo: this.filename, estado: mezcla.conflict ? "error" : "ok", conflictos: mezcla.conflict ? mezcla.bloques : undefined});
            this.recalcularHash([mezcla.hash], nuevo.status.autor);

            return true;
        }

        return false;
    }

    /**
     * Sobreescribe el fichero local con el contenido de la versión indicada.
     *
     * @param basedir - Raíz absoluta del monorepo.
     * @param nuevo   - Estado publicado cuyo contenido se restaura.
     */
    public async resetCambios(basedir: string, nuevo: PaqueteFileFiles): Promise<void> {
        const status = nuevo.status!;

        await safeWrite(`${basedir}/${this.filename}`, await nuevo.files[this.filename].async("text"), true);
        this.hash = status.hash;
        this.autor = status.autor;
    }

    private preMezcla(texto: string): string {
        if (this.filename !== "package.json") {
            return texto;
        }
        return JSON.stringify(normalizarJSON(JSON.parse(texto), PACKAGE_JSON_PRIORIDAD), null, 2) + "\n";
    }

    private async mezclar(basedir: string, nuevo: JSZip.JSZipObject, antiguo?: JSZip.JSZipObject): Promise<{hash: string; conflict: boolean; bloques: IConflictoBloque[]}> {
        let mezcla: string;
        let conflict = false;
        let bloques: IConflictoBloque[] = [];

        if (antiguo===undefined || !await isFile(`${basedir}/${this.filename}`)) {
            mezcla = await nuevo.async("text");
        } else {
            const [a, b, c] = await Promise.all([
                antiguo.async("text"),
                this.getContents(basedir),
                nuevo.async("text"),
            ]);

            const textoA = this.preMezcla(a);
            const textoB = this.preMezcla(b);
            const textoC = this.preMezcla(c);

            const resultado = merge3(textoA, textoB, textoC, this.filename);
            mezcla = resultado.text;
            conflict = resultado.conflict;
            bloques = resultado.bloques;
        }

        await this.crearPath(basedir);
        await safeWrite(`${basedir}/${this.filename}`, mezcla, true);

        return {hash: md5(mezcla), conflict, bloques};
    }
}
