/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: d46b8bd54c765af466ea7dff96675d0e
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import os from "node:os";

import {type IManifest, Manifest} from "@mr/core-dev/manifest";
import {ManifestDeploymentKind, Target} from "@mr/core-dev/manifest/deployment";
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
 * @property buckets   - Mapa opcional de nombres de buckets GCS para el entorno activo, leído del manifiesto.
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
}>;

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
        buckets: manifest.deploy.buckets?.[PRODUCCION&&!TEST?"produccion":"test"],
    }));
}
