import {URLSearchParams} from "node:url";

import type {TMetodo} from "../conexion";
import type {IQuery, Query} from "./querys/query";
import {Regex} from "./querys/regex";
import {Exact} from "./querys/exact";
import {Prefix} from "./querys/prefix";
import {Options} from "./querys/options";
import {Cualquiera} from "./querys/cualquiera";

export interface IDocumentable {
    enabled: boolean;
    descripcion?: string;
}

export interface IExpresion {
    metodos?: TMetodo[];
    dominios?: string[];
    // nota, si no se selecciona ninguno de estos entonces la expresión se ignora
    regex?: RegExp;
    exact?: string;
    prefix?: string;
    comodin?: boolean;
    // fin de nota
    resumen: string;
    checkQuery?: boolean;
    query?: NodeJS.Dict<IQuery>;
    log?: boolean;
    internal?: boolean;
    deprecated?: boolean;
    documentacion?: Partial<IDocumentable>;
}

export interface IExpresionDynamic<T> {
    exact: string;
    dominios?: string[];
    data: T;
}

interface ICheckerData {
    dominio: string;
    metodo: TMetodo;
    url: string;
    query: URLSearchParams;
}

type TCheckFunction = (check: ICheckerData)=>boolean;

export abstract class Checker {
    /* STATIC */

    /* INSTANCE */
    public readonly metodos: TMetodo[];
    public readonly dominios: string[];
    public readonly resumen: string;
    // public readonly query: NodeJS.Dict<Query>;
    public readonly log: boolean;
    public readonly internal: boolean;
    public readonly deprecated: boolean;
    private readonly checkQuery: boolean;
    private readonly query: Query[];
    private readonly checkFunction: TCheckFunction;
    public readonly documentacion: IDocumentable;

    protected constructor(obj: IExpresion) {
        this.metodos = obj.metodos??[];
        this.dominios = obj.dominios??[];
        this.resumen = obj.resumen;
        this.log = obj.log===undefined?true:obj.log;
        this.internal = obj.internal===undefined?false:obj.internal;
        this.deprecated = obj.deprecated===undefined?false:obj.deprecated;
        this.query = [];

        let allMethods: boolean;
        if (this.metodos.length==0) {
            allMethods = true;
        } else if (this.metodos.includes("ALL")) {
            this.metodos = [];
            allMethods = true;
        } else {
            if (this.resumen.startsWith("/web/") && !this.metodos.includes("OPTIONS")) {
                this.metodos.push("OPTIONS");
            }
            if (!this.metodos.includes("HEAD")) {
                this.metodos.push("HEAD");
            }
            allMethods = false;
        }

        const allDomains = this.dominios.length==0;

        if (allMethods) {
            if (allDomains) {
                this.checkFunction = ()=>true;
            } else {
                this.checkFunction = ({dominio}: ICheckerData) => this.dominios.includes(dominio);
            }
        } else {
            if (allDomains) {
                this.checkFunction = ({metodo}: ICheckerData) => this.metodos.includes(metodo);
            } else {
                this.checkFunction = ({dominio, metodo}: ICheckerData) => this.dominios.includes(dominio) && this.metodos.includes(metodo);
            }
        }

        if (obj.query!=undefined) {
            this.checkQuery = obj.checkQuery===undefined?true:obj.checkQuery;
            for (const key of Object.keys(obj.query)) {
                const actual = obj.query[key] as IQuery;
                if (actual.regex!=undefined) {
                    this.query.push(new Regex(key, actual, actual.regex));
                } else if (actual.exact!=undefined) {
                    this.query.push(new Exact(key, actual, actual.exact));
                } else if (actual.prefix!=undefined) {
                    this.query.push(new Prefix(key, actual, actual.prefix));
                } if (actual.options!=undefined) {
                    this.query.push(new Options(key, actual, actual.options));
                } if (actual.cualquiera!=undefined) {
                    this.query.push(new Cualquiera(key, actual, actual.cualquiera));
                }
            }
        } else {
            this.checkQuery = false;
        }
        this.documentacion = {
            enabled: false,
            ...obj.documentacion??{},
        }
    }

    public check(checkerData: ICheckerData): string[]|null {
        if (!this.checkFunction(checkerData)) {
            return null;
        }

        const coincidencias = this.checkEjecutar(checkerData.url);
        if (coincidencias!==null && this.checkQuery) {
            for (const query of this.query) {
                if (!query.check(checkerData.query.getAll(query.key))) {
                    if (!query.opcional) {
                        return null;
                    }
                }
            }
        }

        return coincidencias;
    }

    public update(): void {

    }

    protected abstract checkEjecutar(url: string): string[]|null;
}
