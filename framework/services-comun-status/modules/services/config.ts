/**
 * Editor: Bixus
 * Fecha: Tue, 08 Sep 2026 06:45:12 GMT
 * Hash: 9ee2ea87e2999171fc18031549236e31
 * Versión: 2026.9.8+1-bixus
 * Anterior: 2026.9.4+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {INetServiceBase} from "@mr/core-network/server/http/config/net";
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
    endpoint: "switch-svc-status-backend",
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
