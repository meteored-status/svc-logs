// import * as events from "events";
//
// import {HashElement} from "./element";
//
// export interface IHashCacheConfig {
//     ttl?: number;
//     autoremove?: boolean;
// }
//
// export declare interface HashCache<T> {
//     on(event: "expire", listener: (elemento: T) => void): this;
//     emit(event: "expire", elemento: T): boolean;
// }
//
//
// export class HashCache<T=any> extends events.EventEmitter {
//     private readonly hash: NodeJS.Dict<HashElement<T>>;
//
//     public constructor(private readonly config: IHashCacheConfig = {}) {
//         super();
//
//         this.hash = {};
//     }
//
//     private expire(element: HashElement<T>, force: boolean=false): void {
//         if (element.autoremove || force) {
//             delete this.hash[element.key];
//             element.removeListener("expire", this.expire);
//         }
//         if (!force) {
//             this.emit("expire", element.value);
//         }
//     }
//
//     public clear(): void {
//         for (const key of Object.keys(this.hash)) {
//             const element = this.hash[key];
//             if (element!=undefined) {
//                 element.clear();
//                 this.expire(element, true);
//             }
//         }
//     }
//
//     public push(key: string, value: T, ttl?: number, autoremove?: boolean): HashElement<T> {
//         this.hash[key]?.clear();
//         const nuevo = new HashElement<T>(key, value, ttl??this.config.ttl, (autoremove??this.config.autoremove)??true);
//         this.hash[key] = nuevo;
//         nuevo.on("expire", this.expire);
//
//         return nuevo;
//     }
//
//     public get(key: string): T|undefined {
//         return this.hash[key]?.value;
//     }
//
//     public remove(key: string): void {
//         const element = this.hash[key];
//         if (element!=undefined) {
//             this.expire(element, true);
//         }
//     }
//
//     public updateTTL(key: string, ttl: number): void {
//         const elemento = this.hash[key];
//         if (elemento!=undefined) {
//             elemento.updateTTL(ttl);
//         }
//     }
//
//     public updateExpiracion(key: string, date: Date): void {
//         const elemento = this.hash[key];
//         if (elemento!=undefined) {
//             const ttl = date.getTime()-Date.now();
//             elemento.updateTTL(ttl);
//         }
//     }
// }
export {};
