/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: ffe3b243ec7a4637c9e6a6391ba05d0e
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import http from "node:http";
import https from "node:https";

import {error} from "services-comun/modules/utiles/log";
import type {Kubectl} from "services-comun/modules/utiles/kubectl";
import {random} from "services-comun/modules/utiles/random";

import type {TEnvironment} from "./environment";

type Config = {
    gke?: {
        kubectl: Kubectl;
        serviceName: string;
    }
}

export const doRequest = async <T>(env: TEnvironment, path: string, config?: Config): Promise<T> => {

    const headers: Record<string, string> = {};

    if (env.host) {
        headers['Host'] = env.host;
    }

    const HTTP = env.baseUrl.startsWith("https://") ? https: http;

    return new Promise<T>(async (resolve, reject) => {
        const kubectl = config?.gke?.kubectl;

        if (kubectl) {
            return gkeRequest<T>(kubectl, path, config.gke!.serviceName).then(resolve).catch(reject);
        }

        const url = new URL(`${env.baseUrl}${path}`)

        const req = HTTP.get({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.protocol === 'https:' ? (url.port ? parseInt(url.port) : 443) : (url.port ? parseInt(url.port) : 80),
            rejectUnauthorized: url.protocol === 'https:' ? false : undefined,
            path: path,
            headers: headers,
        }, res => {
            const data: Uint8Array[] = [];
            res.on('data', chunk => {
                data.push(chunk);
            });
            res.on('end', () => {
                const body = Buffer.concat(data).toString();
                try {
                    const json = JSON.parse(body.replaceAll('local-services', 'services')) as T;
                    resolve(json);
                } catch (err) {
                    error(`Error parsing JSON response from ${env.baseUrl}${path}: ${err instanceof Error ? err.message : String(err)}`, err);
                    reject(err);
                }
            });
        });

        req.on('error', err => {
            error(`Error fetching ${env.baseUrl}${path}: ${err.message}`, err);
            reject(err);
        });
    });
}

const gkeRequest = async <T>(kubectl: Kubectl, path: string, service: string): Promise<T> => {
    // Recuperamos los pods
    const pods = await kubectl.getPods();

    // Nos quedamos con un pod running y de tipo servicio
    const validPods = pods.filter(pod => pod.name.startsWith('service') && pod.isRunning());

    if (validPods.length === 0) {
        throw new Error(`No running service pods found`);
    }

    const pod = validPods[Math.floor(Math.random() * validPods.length)];

    const paramPath = path.split('?').slice(1).join('');

    const wget = `http://${service}.meteored-services.svc.cluster.local${path}`;

    let outputFile = `${random()}.json`;

    if (paramPath) {
        if (paramPath.includes('/')) {
            outputFile = paramPath.split('/').slice(1).join('')
        } else {
            outputFile = `?${paramPath}`;
        }
    }

    const wgetCommand: string[] = ['wget', '-q', '-S', wget];

    if (!paramPath) {
        wgetCommand.push('-O', outputFile)
    }

    await kubectl.exec(pod, wgetCommand).catch(err => {
        throw new Error(`Error executing wget in pod ${pod.name}: ${err instanceof Error ? err.message : String(err)}`);
    });

    // Recuperamos el contenido del fichero out.json
    const result = await kubectl.exec(pod, ['cat', outputFile]).catch(err => {
        throw new Error(`Error reading output file in pod ${pod.name}: ${err instanceof Error ? err.message : String(err)}`);
    });

    // Borramos el fichero
    await kubectl.exec(pod, ['rm', outputFile]);

    return JSON.parse(result) as T;
}
