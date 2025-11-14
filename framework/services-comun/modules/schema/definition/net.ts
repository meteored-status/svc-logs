import "reflect-metadata";
import {IExpresion} from "../../net/checkers";
import {Configuracion as ConfiguracionBase} from "../../utiles/config";
import {RouteGroup} from "../../net/routes/group";
import {IRouteGroup} from "../../net/routes/group/block";
import {Conexion} from "../../net/conexion";

const SERVICE_METADATA_KEY = Symbol("mr-service-metadata");
const HANDLER_METADATA_KEY = Symbol("mr-handler-metadata");

type THandler = IExpresion;

/**
 * @experimental
 */
export const Service = <T extends ConfiguracionBase = ConfiguracionBase>(): Function => {
    return function (_target: Function) {
        Reflect.defineMetadata(SERVICE_METADATA_KEY, {}, _target);

        class NewService extends RouteGroup {
            public constructor(config: T, ...args: any[]) {
                super(config)
            }

            protected override getHandlers(): IRouteGroup[] {
                const proto = _target.prototype;
                return Reflect.getMetadata(HANDLER_METADATA_KEY, proto);
            }
        }

        // TODO - Copiar otros métodos estáticos o propiedades si es necesario

        return NewService;
    }
}

/**
 * @experimental
 */
export const Handler = (data: THandler): Function => {
    return function (_target: Object, _propertyKey: string, descriptor: PropertyDescriptor): void {
        const existing: IRouteGroup[] = Reflect.getMetadata(HANDLER_METADATA_KEY, _target) || [];
        existing.push({
            expresiones: [data],
            handler: (conexion: Conexion, url: string[]) => {
                return descriptor.value.apply(_target, [conexion, ...url]);
            },
        });
        Reflect.defineMetadata(HANDLER_METADATA_KEY, existing, _target);
    };
}
