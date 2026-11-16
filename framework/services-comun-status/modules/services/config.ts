/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 10:50:41 GMT
 * Hash: 4e97cba4402266048155925766c01ef7
 * Versión: 2026.11.13+1-bixus
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {INetServiceBase} from "@mr/core-network/server/http/config/net";
import {Service} from "@mr/core-network/server/http/service";

export enum EService {
    logs_slave,
    status_backend,
    status_external,
    status_frontend,
    workers_slave,
}

const mapeo = new Map<EService, INetServiceBase>();

mapeo.set(EService.logs_slave, {
    endpoint: "proxy-svc-logs-slave",
    namespace: "services",
    tags: ["logs", "slave"],
    slow: 0,
});
mapeo.set(EService.status_backend, {
    endpoint: "proxy-svc-status-backend",
    namespace: "services",
    tags: ["status", "status-backend"],
});
mapeo.set(EService.status_external, {
    endpoint: "proxy-svc-status-external",
    namespace: "services",
    tags: ["status", "status-external"],
});
mapeo.set(EService.status_frontend, {
    endpoint: "proxy-svc-status-frontend",
    namespace: "services",
    tags: ["status", "status-frontend"],
});
mapeo.set(EService.workers_slave, {
    endpoint: "proxy-svc-workers-slave",
    namespace: "services",
    tags: ["workers", "slave"],
});

export const SERVICES = new Service(mapeo, {
    prefix: "mr-status",
    builder: (id: EService)=>EService[id].replace(/_/g, "-"),
});
