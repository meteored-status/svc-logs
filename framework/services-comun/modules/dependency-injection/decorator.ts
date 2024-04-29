import catalog from "./instance-catalog";

export function Component(name: string) {
    return (clazz: {new () : any}) => {
        catalog.setInstance(name, new clazz());
    }
}

export function Inject(name: string) {
    return (instance: any, property: string) => {
        Object.defineProperty(instance, property, {
            get: () => catalog.getInstance(name),
        });
    }
}
