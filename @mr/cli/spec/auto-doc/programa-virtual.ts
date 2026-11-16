/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 2655f137cb978ec2825833857f7306d7
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import ts from "typescript";

import type {ISchema} from "services-comun/modules/openapi/interface";

import type {IAviso} from "../../src/clases/auto-doc/avisos";
import type {IResultadoRutas} from "../../src/clases/auto-doc/modelo";
import {GeneradorEsquemas} from "../../src/clases/auto-doc/esquema";
import {extraerRutas} from "../../src/clases/auto-doc/rutas";

/**
 * Resultado de convertir un tipo.
 *
 * @property esquema     - Esquema del tipo (un `$ref` si el tipo se registra como componente).
 * @property componentes - Componentes registrados.
 * @property avisos      - Incidencias.
 */
export interface IResultadoEsquema {
    esquema: ISchema;
    componentes: Record<string, ISchema>;
    avisos: IAviso[];
}

/**
 * Resultado de {@link campoDe}.
 *
 * @property campo       - Esquema de la propiedad.
 * @property obligatorio - Si la propiedad está en `required`.
 */
export interface ICampoEsquema extends IResultadoEsquema {
    campo: ISchema;
    obligatorio: boolean;
}

/** Raíz de los ficheros virtuales. */
export const RAIZ = "/v";

/**
 * Stub de `@mr/core-network/server/http/routes/group`: lo justo de `RouteGroup`, `RouteGroupError` e
 * `IRouteGroup` para que el auto-doc reconozca las clases por símbolo y fichero.
 */
const STUB_ROUTE_GROUP = `
import type {IContract} from "./contract";
export interface IExpresion {
    metodos?: string[];
    exact?: string;
    regex?: RegExp;
    resumen: string;
    query?: Record<string, unknown>;
    post?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    response?: Record<string, unknown>;
    internal?: boolean;
    deprecated?: boolean;
    documentacion?: {descripcion?: string};
    contract?: IContract;
}
export interface IRouteGroup {
    expresiones?: IExpresion[];
    documentable?: boolean;
    contract?: IContract;
}
export abstract class RouteGroup<T = unknown> {
    public constructor(config: T, params?: {documentable?: boolean}) {}
    protected abstract getHandlers(): IRouteGroup[];
}
export abstract class RouteGroupError<T = unknown> extends RouteGroup<T> {}
`;

/** Stub de `contract.ts`: lo mismo que el real, sin comentarios. */
const STUB_CONTRATO = `
export interface IContractTypes {post?: unknown; response?: unknown; query?: unknown; headers?: unknown;}
export interface IContractConfig {errors?: number[]; description?: string; envelope?: boolean;}
export interface IContract<T extends IContractTypes = IContractTypes> extends IContractConfig {readonly types?: T;}
export function Contract<T extends IContractTypes>(config: IContractConfig = {}): IContract<T> {return {...config};}
`;

/** Una clase que se llama igual pero no es la de `@mr/core-network`. */
const STUB_FALSO = `export abstract class RouteGroup { protected abstract getHandlers(): unknown[]; }`;

/**
 * Crea un programa TypeScript con los ficheros dados en memoria (más las libs reales de `typescript`).
 * Los módulos `@mr/core-network/*` se resuelven contra `/v/@mr/core-network/*`.
 *
 * @param ficheros - Ruta absoluta virtual → contenido.
 */
export function crearProgramaVirtual(ficheros: Record<string, string>): ts.Program {
    const opciones: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        noEmit: true,
        types: [],
        baseUrl: RAIZ,
        paths: {"@mr/core-network/*": [`${RAIZ}/@mr/core-network/*`], "falso/*": [`${RAIZ}/falso/*`]},
    };
    const base = ts.createCompilerHost(opciones, true);
    const virtual = new Map(Object.entries(ficheros));

    const host: ts.CompilerHost = {
        ...base,
        fileExists: (f) => virtual.has(f) || (!f.startsWith(`${RAIZ}/`) && base.fileExists(f)),
        readFile: (f) => virtual.get(f) ?? (f.startsWith(`${RAIZ}/`) ? undefined : base.readFile(f)),
        getSourceFile: (f, lang, onError, soloRegistro) => {
            const texto = virtual.get(f);
            if (texto !== undefined) {
                return ts.createSourceFile(f, texto, lang, true);
            }

            return f.startsWith(`${RAIZ}/`) ? undefined : base.getSourceFile(f, lang, onError, soloRegistro);
        },
        getCurrentDirectory: () => RAIZ,
        directoryExists: (d) => d === RAIZ || d.startsWith(`${RAIZ}/`) || (base.directoryExists?.(d) ?? false),
    };

    return ts.createProgram({rootNames: Object.keys(ficheros).filter(f => f.endsWith("main.ts")), options: opciones, host});
}

/**
 * Programa virtual con `main.ts` y los stubs de `RouteGroup` (el de verdad y uno falso en `falso/group`).
 *
 * @param codigo - Contenido de `main.ts`.
 * @param extra  - Ficheros adicionales.
 */
export function programaDe(codigo: string, extra: Record<string, string> = {}): ts.Program {
    return crearProgramaVirtual({
        [`${RAIZ}/main.ts`]: codigo,
        [`${RAIZ}/@mr/core-network/server/http/routes/group/index.ts`]: STUB_ROUTE_GROUP,
        [`${RAIZ}/@mr/core-network/server/http/routes/group/contract.ts`]: STUB_CONTRATO,
        [`${RAIZ}/falso/group.ts`]: STUB_FALSO,
        ...extra,
    });
}

/**
 * Lee las rutas de un `main.ts` virtual.
 *
 * @param codigo - Contenido de `main.ts`.
 * @param extra  - Ficheros adicionales.
 */
export function rutasDe(codigo: string, extra: Record<string, string> = {}): IResultadoRutas {
    return extraerRutas(programaDe(codigo, extra), RAIZ);
}

/**
 * Convierte el tipo `T` declarado en `main.ts` (más los ficheros extra) con el generador de esquemas.
 *
 * @param codigo - Contenido de `main.ts`; tiene que declarar un tipo llamado `T`.
 * @param extra  - Ficheros adicionales.
 */
export function esquemaDeTipo(codigo: string, extra: Record<string, string> = {}): IResultadoEsquema {
    const programa = crearProgramaVirtual({[`${RAIZ}/main.ts`]: codigo, ...extra});
    const typeChecker = programa.getTypeChecker();
    const fichero = programa.getSourceFile(`${RAIZ}/main.ts`)!;
    const declaracion = fichero.statements.find((s): s is ts.TypeAliasDeclaration | ts.InterfaceDeclaration => (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) && s.name.text === "T");
    if (declaracion === undefined) {
        throw new Error("main.ts no declara T");
    }

    const avisos: IAviso[] = [];
    const generador = new GeneradorEsquemas(typeChecker, RAIZ, avisos);
    const tipo = typeChecker.getDeclaredTypeOfSymbol(typeChecker.getSymbolAtLocation(declaracion.name)!);
    const esquema = generador.esquemaDe(tipo, declaracion);

    return {esquema, componentes: generador.componentes, avisos};
}

/**
 * Esquema de una propiedad `campo` de `interface Raiz`: así el tipo sale en línea (sin que su propio alias lo
 * registre como componente) y se puede ver si `campo` es obligatorio.
 *
 * @param tipo  - Tipo TypeScript de `campo`.
 * @param otros - Declaraciones auxiliares de `main.ts`.
 * @param extra - Ficheros adicionales.
 */
export function campoDe(tipo: string, otros = "", extra: Record<string, string> = {}): ICampoEsquema {
    const salida = esquemaDeTipo(`${otros}\ninterface Raiz {campo: ${tipo}}\ntype T = Raiz;`, extra);
    const raiz = salida.componentes["Raiz"];

    return {...salida, campo: raiz.properties!["campo"], obligatorio: raiz.required?.includes("campo") ?? false};
}

/** Cabecera de import habitual de un grupo de rutas virtual. */
export const IMPORT_RG = `import {RouteGroup, RouteGroupError, type IRouteGroup} from "@mr/core-network/server/http/routes/group";\n`;
