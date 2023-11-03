import {INetServiceBase} from "services-comun/modules/net/config/net";
import {Service} from "services-comun/modules/net/service";

export enum EService {
    status,
    status_auth,
    status_backend,
    status_external,
    status_logs_slave,
    status_webhook,
}

const mapeo = new Map<EService, INetServiceBase>();

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
mapeo.set(EService.status_logs_slave, {
    endpoint: "proxy-svc-status-logs-slave",
    namespace: "services",
    tags: ["logs", "slave"],
});
mapeo.set(EService.status_webhook, {
    endpoint: "proxy-svc-status-webhook",
    namespace: "services",
    tags: ["status", "webhook"],
});

export const SERVICES = new Service(mapeo);
