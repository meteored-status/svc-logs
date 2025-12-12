import os from "node:os";

import {type IManifest, Manifest} from "@mr/cli/manifest";

import {md5} from "./hash";
import {random} from "./random";
import {readJSON} from "./fs";
import {ManifestDeploymentKind, Target} from "@mr/cli/manifest/deployment";

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

export async function crearPodInfo(): Promise<IPodInfo> {
    const [data, manifest] = await Promise.all([
        readJSON("package.json"),
        readJSON<IManifest>("mrpack.json")
            .then((data)=>new Manifest(data)),
    ]);
    const imagen = PRODUCCION && !TEST ?
        manifest.deploy.imagen?.produccion.nombre :
        manifest.deploy.imagen?.test.nombre;
    const sidecar = PRODUCCION && [ManifestDeploymentKind.SERVICE, ManifestDeploymentKind.CRONJOB, ManifestDeploymentKind.JOB].includes(manifest.deploy.type) && manifest.deploy.target===Target.k8s;
    const servicios = manifest.deploy.kustomize?.map(k=>k.name) ?? [];
    if (servicios.length===0) {
        servicios.push(imagen??"unknown");
    }

    const host = PRODUCCION?os.hostname():servicios[0];

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
