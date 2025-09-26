export interface IOptions {
    required: boolean;
}

export type IPartialOptions = Partial<IOptions>;
export type EventFn<T extends HTMLElement> = (element: T, ev: Event)=>void;

export abstract class Validator<T extends HTMLElement = HTMLElement> {
    /* INSTANCE */
    protected readonly options: IOptions;

    protected constructor(public readonly element: T|null, options: IPartialOptions = {}) {
        this.options = {
            required: false,
            ...options,
        };
    }

    public addEvent(name: string, fn: EventFn<T>): void {
        if (this.element!=null) {
            this.element.addEventListener(name, (ev) => fn(this.element!, ev));
        }
    }

    public abstract validate(): Promise<boolean>;
}
