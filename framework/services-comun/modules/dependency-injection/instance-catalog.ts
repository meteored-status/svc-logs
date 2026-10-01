/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 77820a6d9776415318adaef3ba2c7340
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

class InstanceCatalog {
    /* INSTANCE */
    private readonly _instances: Map<string, any>;

    public constructor() {
        this._instances = new Map<string, any>();
    }

    public getInstance(name: string): any {
        return this._instances.get(name);
    }

    public setInstance(name: string, instance: any): void {
        this._instances.set(name, instance);
    }
}

export default new InstanceCatalog();
