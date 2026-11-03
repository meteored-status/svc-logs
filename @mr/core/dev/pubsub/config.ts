/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 81ca7dffe20c2d74bf0d7245848da905
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import {readFile} from "node:fs/promises";
import path from "node:path";

/**
 * Datos de conexión del emulador de Pub/Sub.
 *
 * @property host - `host:puerto` del emulador, tal y como lo espera `PUBSUB_EMULATOR_HOST`.
 * @property proyecto - Proyecto con el que se crean los recursos (`PUBSUB_PROJECT_ID`).
 * @property pushHost - Host por el que el emulador, que corre en un docker, llega a los servicios de la máquina.
 */
export interface IConfigEmulador {
    host: string;
    proyecto: string;
    pushHost: string;
}

/**
 * Lo que se puede sobrescribir de {@link IConfigEmulador}: el bloque opcional `pubsub` de `config.workspaces.json`.
 */
export interface IConfigEmuladorParcial {
    host?: string;
    proyecto?: string;
    pushHost?: string;
}

/**
 * Entrada de {@link resolverConfigEmulador}.
 *
 * @property env - Variables de entorno (`process.env`).
 * @property fichero - Bloque `pubsub` de `config.workspaces.json`, si lo hay.
 */
export interface IResolverConfigEmulador {
    env: Record<string, string | undefined>;
    fichero?: IConfigEmuladorParcial;
}

/**
 * Configuración por defecto: el docker `pubsub` de mrenv.
 */
export const CONFIG_EMULADOR_DEFECTO: IConfigEmulador = {
    host: "localhost:8085",
    proyecto: "meteored-local",
    pushHost: "host.docker.internal",
};

const CLAVES = ["host", "proyecto", "pushHost"] as const;

function elegir(...candidatos: (string | undefined)[]): string | undefined {
    return candidatos.find((candidato) => candidato !== undefined && candidato !== "");
}

/**
 * Decide los datos de conexión del emulador.
 *
 * Precedencia: variable de entorno (`PUBSUB_EMULATOR_HOST`, `PUBSUB_PROJECT_ID`, `MRPACK_PUBSUB_PUSH_HOST`) sobre el
 * bloque `pubsub` de `config.workspaces.json` sobre {@link CONFIG_EMULADOR_DEFECTO}. Una cadena vacía cuenta como ausente.
 *
 * @param config - Entorno y bloque del fichero.
 * @returns Configuración completa.
 */
export function resolverConfigEmulador({env, fichero}: IResolverConfigEmulador): IConfigEmulador {
    return {
        host: elegir(env["PUBSUB_EMULATOR_HOST"], fichero?.host) ?? CONFIG_EMULADOR_DEFECTO.host,
        proyecto: elegir(env["PUBSUB_PROJECT_ID"], fichero?.proyecto) ?? CONFIG_EMULADOR_DEFECTO.proyecto,
        pushHost: elegir(env["MRPACK_PUBSUB_PUSH_HOST"], fichero?.pushHost) ?? CONFIG_EMULADOR_DEFECTO.pushHost,
    };
}

/**
 * Lee el bloque opcional `pubsub` de `<raiz>/config.workspaces.json`.
 *
 * Se ignoran las claves que no son `host`, `proyecto` ni `pushHost`: ese fichero lo comparten otras herramientas.
 *
 * @param raiz - Raíz del monorepo.
 * @returns El bloque, o `undefined` si no existe el fichero o no tiene el bloque.
 * @throws {Error} Si el fichero no es JSON válido o alguna de las tres claves no es una cadena.
 */
export async function leerConfigEmulador(raiz: string): Promise<IConfigEmuladorParcial | undefined> {
    const fichero = path.join(raiz, "config.workspaces.json");
    let contenido: string;
    try {
        contenido = await readFile(fichero, "utf8");
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return undefined;
        }
        throw err;
    }

    let datos: unknown;
    try {
        datos = JSON.parse(contenido);
    } catch (err) {
        throw new Error(`${fichero} no es un JSON válido: ${err instanceof Error ? err.message : String(err)}`);
    }

    const bloque = typeof datos === "object" && datos !== null ? (datos as Record<string, unknown>)["pubsub"] : undefined;
    if (bloque === undefined) {
        return undefined;
    }
    if (typeof bloque !== "object" || bloque === null || Array.isArray(bloque)) {
        throw new Error(`${fichero}: "pubsub" debe ser un objeto {host?, proyecto?, pushHost?}`);
    }

    const config: IConfigEmuladorParcial = {};
    for (const clave of CLAVES) {
        const valor = (bloque as Record<string, unknown>)[clave];
        if (valor === undefined) {
            continue;
        }
        if (typeof valor !== "string") {
            throw new Error(`${fichero}: "pubsub.${clave}" debe ser una cadena`);
        }
        config[clave] = valor;
    }
    return config;
}
