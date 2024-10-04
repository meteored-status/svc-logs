import type {Respuesta} from "../respuesta";

export type Parser<T=any> = (response: Response)=>Promise<Respuesta<T>>;
