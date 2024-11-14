export abstract class PluginTemplate<T> {
    public abstract name: string;
    public abstract version: string;

    protected constructor(public readonly app: T) {
    }

    public abstract start(): Promise<void>;
    public abstract stop():  Promise<void>;
}
