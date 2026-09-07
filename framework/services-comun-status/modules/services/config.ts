/**
 * Editor: Bixus
 * Fecha: Fri, 04 Sep 2026 11:24:52 GMT
 * Hash: 4ae87d7f05c75c88e4b161ee3ceb3816
 * Versión: 2026.9.4+2-bixus
 * Anterior: 2026.8.21+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {INetServiceBase} from "@mr/core-network/server/http/config/net";
import {Service} from "@mr/core-network/server/http/service";

export enum EService {
    logs_slave,
    logs_web,
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
mapeo.set(EService.logs_web, {
    endpoint: "proxy-svc-logs-web",
    namespace: "services",
    tags: ["logs", "web"],
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
