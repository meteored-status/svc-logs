class InstanceCatalog {
    /* STATIC */

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
