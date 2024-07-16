import {INetServiceBase} from "services-comun/modules/net/config/net";
import {Service} from "services-comun/modules/net/service";

export enum EService {
    logs_slave,
    status,
    status_auth,
    status_backend,
    status_external,
    status_frontend,
    status_webhook,
    workers_slave,
}

const mapeo = new Map<EService, INetServiceBase>();

mapeo.set(EService.logs_slave, {
    endpoint: "proxy-svc-logs-slave",
    namespace: "services",
    tags: ["logs", "slave"],
});
mapeo.set(EService.status, {
    endpoint: "proxy-svc-status",
    namespace: "services",
    tags: ["status"],
});
mapeo.set(EService.status_auth, {
    endpoint: "proxy-svc-status-auth",
    namespace: "services",
    tags: ["status", "status-auth"],
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
mapeo.set(EService.status_webhook, {
    endpoint: "proxy-svc-status-webhook",
    namespace: "services",
    tags: ["status", "webhook"],
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
