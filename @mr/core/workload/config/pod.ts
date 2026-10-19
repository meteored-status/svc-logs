/**
 * Editor: Pedro
 * Fecha: Mon, 05 Oct 2026 10:56:47 GMT
 * Hash: 7a15f543086a3c0df980250d6708cb6c
 * Versión: 2026.10.5+1-pedro
 * Anterior: 2026.6.17+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-panel-usuarios.git
 */

import os from "node:os";

import {type IManifest, Manifest} from "@mr/core-dev/manifest";
import {ManifestDeploymentKind, Target, type TManifestDeploymentBucketData} from "@mr/core-dev/manifest/deployment";
import {md5} from "services-comun/modules/utiles/hash";
import {random} from "services-comun/modules/utiles/random";
import {readJSON} from "services-comun/modules/utiles/fs";

/**
 * Metadatos inmutables del pod que se resuelven una sola vez durante el arranque
 * del servicio mediante {@link crearPodInfo}.
 *
 * @property filesdir  - Directorio raíz de ficheros del servicio (siempre `"files"`).
 * @property version   - Versión del servicio, leída de `package.json`.
 * @property hash      - Hash MD5 de la versión; se usa como ETag global de la build.
 * @property host      - Nombre del host: en producción `os.hostname()`, en desarrollo el primer servicio del kustomize.
 * @property servicio  - Nombre del servicio activo (primer elemento de `servicios` cuyo nombre contiene `host`).
 * @property servicios - Lista de nombres de servicios del kustomize (mínimo un elemento).
 * @property zona      - Zona de despliegue, leída de la variable de entorno `ZONA`; `"desarrollo"` por defecto.
 * @property cronjob   - `true` si el manifiesto declara que el servicio es un cronjob.
 * @property sidecar   - `true` si el servicio corre en k8s en producción y necesita el sidecar de Istio.
 * @property replica   - Identificador de réplica del pod (producción) o cadena aleatoria de 5 chars (desarrollo).
 * @property wire      - Número de wire del pod en producción; `0` en desarrollo o cuando no aplica.
 * @property deploy    - Identificador del deployment (producción) o cadena aleatoria de 10 chars (desarrollo).
 * @property buckets  - Mapa opcional de buckets GCS para el entorno activo, leído del manifiesto (`deploy.buckets`).
 *                        Cada clave es un nombre de bucket o una lista de nombres; si en el manifiesto es
 *                        `{buckets, basePath?}` aquí solo queda `buckets` (ver {@link aplanarBuckets}).
 * @property bucketsBasePath - Prefijo de almacenamiento (`basePath`) de las claves de `buckets` que lo definen en el
 *                        manifiesto. Solo contiene las claves con prefijo; no existe si ninguna lo tiene.
 */
export type IPodInfo = Readonly<{
    filesdir: string;
    version: string;
    hash: string;
    host: string;
    servicio: string;
    servicios: [string, ...string[]];
    zona: string;
    cronjob: boolean;
    sidecar: boolean;
    replica: string;
    wire: number;
    deploy: string;
    buckets?: Record<string, string | string[]>;
    bucketsBasePath?: Record<string, string>;
}>;

/**
 * Resultado de {@link aplanarBuckets}.
 *
 * @property buckets - Clave → nombre o lista de nombres de buckets.
 * @property basePath - Clave → prefijo, solo para las claves que lo definen.
 */
export interface IBucketsAplanados {
    buckets: Record<string, string | string[]>;
    basePath: Record<string, string>;
}

/**
 * Aplana los buckets de un entorno del manifiesto (`deploy.buckets.<entorno>`) a la forma de {@link IPodInfo}:
 * los valores en forma de objeto `{buckets, basePath?}` pasan a su `buckets`, y su `basePath` (si lo hay) va aparte.
 *
 * @param data - Buckets del entorno; puede no estar definido.
 */
export function aplanarBuckets(data: TManifestDeploymentBucketData | undefined): IBucketsAplanados | undefined {
    if (data === undefined) {
        return undefined;
    }
    const buckets: Record<string, string | string[]> = {};
    const basePath: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(data)) {
        if (typeof valor === "string" || Array.isArray(valor)) {
            buckets[clave] = valor;
        } else {
            buckets[clave] = valor.buckets;
            if (valor.basePath !== undefined) {
                basePath[clave] = valor.basePath;
            }
        }
    }
    return {buckets, basePath};
}

/**
 * Resuelve los metadatos del pod leyendo `package.json` y `mrpack.json` en paralelo.
 *
 * ### Lógica de resolución
 *
 * - **`version`** — leída de `package.json`.
 * - **`host`** — en producción `os.hostname()`; en desarrollo, el primer servicio del kustomize.
 * - **`servicio`** — primer elemento de `servicios` cuyo nombre aparece en `host`.
 * - **`sidecar`** — activado en producción cuando la variable de entorno `SIDECAR` tiene el valor true y el tipo de deployment es `SERVICE`, `CRONJOB` o `JOB` y el target es k8s.
 * - **`replica` / `wire` / `deploy`** — derivados del hostname en producción mediante análisis de sus partes separadas por `-`.
 *   En desarrollo se generan cadenas aleatorias.
 *
 * El objeto devuelto está sellado (`Object.seal`) y congelado (`Object.freeze`),
 * por lo que es efectivamente inmutable en runtime.
 */
export async function crearPodInfo(): Promise<IPodInfo> {
    const [data, manifest] = await Promise.all([
        readJSON("package.json"),
        readJSON<IManifest>("mrpack.json")
            .then((data)=>new Manifest(data)),
    ]);
    const imagen = PRODUCCION && !TEST ?
        manifest.deploy.imagen?.produccion.nombre :
        manifest.deploy.imagen?.test.nombre;
    const sidecar = PRODUCCION && process.env["SIDECAR"]==="true" && [ManifestDeploymentKind.SERVICE, ManifestDeploymentKind.CRONJOB, ManifestDeploymentKind.JOB].includes(manifest.deploy.type) && manifest.deploy.target===Target.k8s;
    const servicios = manifest.deploy.kustomize?.map(k=>k.name) ?? [];
    if (servicios.length===0) {
        servicios.push(imagen??"unknown");
    }

    const host = PRODUCCION ?
        os.hostname() :
        servicios[0];

    const partes = host.split("-");
    let replica: string;
    let wire: number;
    let deploy: string;
    const cronjob = manifest.deploy.cronjob ?? false;
    const version = data.version??`0000.00.00-000`;
    if (PRODUCCION) {
        replica = partes[-1] ?? "test";
        if (!cronjob) {
            wire = 0;
            deploy = partes[-2] ?? "test";
        } else {
            const tmpWire = partes[-1];
            if (tmpWire) {
                if (!isNaN(parseFloat(tmpWire)) && isFinite(tmpWire as any)) {
                    wire = parseInt(tmpWire);
                    deploy = partes[-3] ?? "test";
                } else {
                    wire = 0;
                    deploy = tmpWire;
                }
            } else {
                wire = 0;
                deploy = "test";
            }
        }
    } else {
        replica = random(5).toLowerCase();
        wire = 0;
        deploy = random(10).toLowerCase();
    }

    const aplanados = aplanarBuckets(manifest.deploy.buckets?.[PRODUCCION&&!TEST?"produccion":"test"]);
    const servicio = servicios.find(svc=>host.includes(svc))??servicios[0];

    return Object.freeze(Object.seal({
        filesdir: 'files',
        version,
        hash: md5(version),
        host,
        servicio,
        servicios: servicios as [string, ...string[]],
        zona: process.env["ZONA"]??"desarrollo",
        cronjob,
        sidecar,
        replica,
        wire,
        deploy,
        buckets: aplanados?.buckets,
        ...(aplanados && Object.keys(aplanados.basePath).length>0 ? {bucketsBasePath: aplanados.basePath} : {}),
    }));
}
