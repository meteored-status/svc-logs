export abstract class ManifestRoot<T> {
    /* INSTANCE */
    protected constructor() {
    }

    public abstract toJSON(): T;
}
