import {Cache, CacheBuilder as CacheBuilderBase, type ICacheDoc} from ".";

class MockCache<T> extends Cache<T>{
    /* INSTANCE */
    public constructor() {
        super("mock", {cleanup: false});
    }

    protected async fromCache(): Promise<ICacheDoc<T>|undefined> {
        return undefined;
    }

    protected async toCache(): Promise<void> {
    }

    protected cleanCache(): void {
    }
}

class CacheBuilder extends CacheBuilderBase {
    /* INSTANCE */
    public constructor() {
        super();
    }

    public override async get<T>(): Promise<Cache<T>> {
        return super.get("mock");
    }

    protected async build<T>(): Promise<Cache<T>> {
        return new MockCache<T>();
    }
}

export default new CacheBuilder();
