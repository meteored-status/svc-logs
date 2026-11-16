/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 11:55:33 GMT
 * Hash: 6bd536977d8c96283460495caca983ad
 * Versión: 2026.11.12+1-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import ts from "typescript";

import type {ISchema} from "services-comun/modules/openapi/interface";

import type {IAviso, TSeveridad} from "./avisos";
import type {IParametroTipado} from "./modelo";
import {ubicacionDe} from "./avisos";
import {canonico} from "./canonico";
import {LectorJSDoc} from "./jsdoc";

/** Niveles de anidamiento a partir de los cuales un tipo se da por no representable. */
const PROFUNDIDAD_MAX = 32;

/** Tipos de librería que no tienen forma JSON (o no una que se pueda describir): se documentan como `{}` con aviso. */
const NO_REPRESENTABLES = new Set([
    "Promise", "Map", "Set", "WeakMap", "WeakSet", "WeakRef", "RegExp", "Error", "ArrayBuffer", "SharedArrayBuffer", "DataView", "Buffer", "Function", "Symbol",
]);

const TYPED_ARRAY = /^(Big)?(Int|Uint|Float)\d+(Clamped)?Array$/;

/** Propiedad de un tipo objeto, ya convertida. */
interface IPropiedad {
    nombre: string;
    schema: ISchema;
    required: boolean;
    description?: string;
    deprecated: boolean;
}

/**
 * Convierte tipos TypeScript en esquemas JSON (OpenAPI 3.1) con el `TypeChecker` del programa.
 *
 * Las interfaces, alias y enums con nombre propio (y sin argumentos de tipo) se registran en
 * {@link GeneradorEsquemas.componentes} y se referencian con `$ref`, así que un tipo recursivo termina. Lo demás
 * (genéricos instanciados, `Partial`, mapeados, literales de objeto) va en línea. Lo que no tiene forma JSON
 * (`bigint`, `Buffer`, funciones, clases con getters, parámetros de tipo sin instanciar...) se documenta como `{}`
 * y se avisa; un tipo que no se resuelve (un import roto) es un `error`.
 *
 * Los nombres que chocan (dos interfaces `IConfig` de ficheros distintos) se desambiguan: el primero en
 * llegar conserva el nombre y el resto lleva como sufijo la ruta de su fichero. Quién llega primero lo decide
 * `extraerRutas`, que lee los contratos de las operaciones públicas antes que los de las privadas.
 */
export class GeneradorEsquemas {
    private readonly typeChecker: ts.TypeChecker;
    private readonly raiz: string;
    private readonly avisos: IAviso[];
    private readonly jsdoc: LectorJSDoc;
    private readonly nombres: Map<ts.Symbol, string>;
    private readonly ocupados: Set<string>;
    private readonly registrados: Record<string, ISchema>;
    private readonly pila: ts.Type[];
    private readonly ruta: string[];
    private readonly vistos: Set<string>;

    /**
     * Componentes registrados (`components.schemas`), con las claves ordenadas.
     */
    public get componentes(): Record<string, ISchema> {
        const salida: Record<string, ISchema> = {};
        for (const nombre of Object.keys(this.registrados).sort()) {
            salida[nombre] = this.registrados[nombre];
        }

        return salida;
    }

    /**
     * @param typeChecker - Checker del programa.
     * @param raiz        - Raíz del monorepo, para las ubicaciones de los avisos.
     * @param avisos      - Lista donde se acumulan las incidencias.
     */
    public constructor(typeChecker: ts.TypeChecker, raiz: string, avisos: IAviso[]) {
        this.typeChecker = typeChecker;
        this.raiz = raiz;
        this.avisos = avisos;
        this.jsdoc = new LectorJSDoc(typeChecker);
        this.nombres = new Map();
        // Nombres de los esquemas comunes que genera `openapi.ts`: un tipo del código que se llame igual no los pisa.
        this.ocupados = new Set(["RespuestaKO", "RespuestaOK"]);
        this.registrados = {};
        this.pila = [];
        this.ruta = [];
        this.vistos = new Set();
    }

    /**
     * Esquema JSON de un tipo.
     *
     * @param tipo - Tipo a convertir.
     * @param nodo - Nodo del código que lo pide (ubicación de los avisos).
     */
    public esquemaDe(tipo: ts.Type, nodo: ts.Node): ISchema {
        if (this.pila.length >= PROFUNDIDAD_MAX) {
            this.incidencia("aviso", `tipo demasiado anidado (más de ${PROFUNDIDAD_MAX} niveles)${this.donde()}: se documenta como {}`, nodo);
            return {};
        }

        return this.convertir(tipo, nodo);
    }

    /**
     * Propiedades de un tipo objeto como parámetros (`query`, `headers`). `undefined` si el tipo no es un objeto.
     *
     * @param tipo - Tipo del conjunto de parámetros.
     * @param nodo - Nodo del código que lo pide.
     */
    public parametrosDe(tipo: ts.Type, nodo: ts.Node): IParametroTipado[] | undefined {
        const sinNulos = this.typeChecker.getNonNullableType(tipo);
        if (!(sinNulos.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection))) {
            this.incidencia("aviso", `«${this.typeChecker.typeToString(tipo)}» no es un objeto: no se pueden sacar parámetros de él`, nodo);
            return undefined;
        }

        return this.propiedades(sinNulos, nodo).map(p => ({nombre: p.nombre, schema: p.schema, required: p.required, description: p.description}));
    }

    /**
     * `true` si el tipo admite `undefined` (o es `void`).
     *
     * @param tipo - Tipo a comprobar.
     */
    public admiteUndefined(tipo: ts.Type): boolean {
        const vacio = ts.TypeFlags.Undefined | ts.TypeFlags.Void;
        if (tipo.flags & vacio) {
            return true;
        }

        return tipo.isUnion() && tipo.types.some(t => (t.flags & vacio) !== 0);
    }

    private convertir(tipo: ts.Type, nodo: ts.Node): ISchema {
        const simple = this.primitivo(tipo, nodo);
        if (simple !== undefined) {
            return simple;
        }

        const objetual = (tipo.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) !== 0;
        if (objetual) {
            const viaJSON = this.viaToJSON(tipo, nodo);
            if (viaJSON !== undefined) {
                return viaJSON;
            }
            const motivo = this.noRepresentable(tipo);
            if (motivo !== undefined) {
                this.incidencia("aviso", `${motivo}${this.donde()} no se puede describir: se documenta como {}`, nodo);
                return {};
            }
        }

        const simbolo = this.simboloDeComponente(tipo);
        if (simbolo === undefined) {
            return this.construir(tipo, nodo);
        }

        const existente = this.nombres.get(simbolo);
        if (existente !== undefined) {
            return {$ref: `#/components/schemas/${existente}`};
        }

        const nombre = this.asignarNombre(simbolo);
        this.nombres.set(simbolo, nombre);
        this.registrados[nombre] = {};
        // Un componente con nombre ya está en `nombres`: volver a entrar en él termina con un `$ref`. La pila solo vale
        // para recursiones sin nombre, así que se aparta mientras se construye (`IMenu[]` → `IMenu` → `IMenu[]` no es una).
        const apartada = this.pila.splice(0);
        let esquema: ISchema;
        try {
            esquema = this.construir(tipo, nodo);
        } finally {
            this.pila.push(...apartada);
        }
        const descripcion = this.jsdoc.descripcionDeTipo(simbolo);
        if (descripcion !== undefined) {
            esquema.description = descripcion;
        }
        if (this.jsdoc.esDeprecated(simbolo)) {
            esquema.deprecated = true;
        }
        this.registrados[nombre] = esquema;

        return {$ref: `#/components/schemas/${nombre}`};
    }

    /**
     * Tipos sin estructura: primitivos, literales, `any`/`unknown` y lo que no se puede representar.
     */
    private primitivo(tipo: ts.Type, nodo: ts.Node): ISchema | undefined {
        const {flags} = tipo;
        const F = ts.TypeFlags;
        if (flags & F.Any) {
            if ((tipo as unknown as {intrinsicName?: string}).intrinsicName === "error") {
                this.incidencia("error", `no se puede resolver el tipo${this.donde()} (¿import roto o tipo inexistente?)`, nodo);
            }

            return {};
        }
        if (flags & F.Unknown) {
            return {};
        }
        if (flags & F.Boolean) {
            return {type: "boolean"};
        }
        if (flags & F.BooleanLiteral) {
            return {type: "boolean", const: this.typeChecker.typeToString(tipo) === "true"};
        }
        if (flags & F.StringLiteral) {
            return {type: "string", const: (tipo as ts.StringLiteralType).value};
        }
        if (flags & F.NumberLiteral) {
            return {type: "number", const: (tipo as ts.NumberLiteralType).value};
        }
        if (flags & (F.String | F.TemplateLiteral | F.StringMapping)) {
            return {type: "string"};
        }
        if (flags & F.NumberLike) {
            return {type: "number"};
        }
        if (flags & (F.BigIntLike | F.ESSymbolLike)) {
            this.incidencia("aviso", `«${this.typeChecker.typeToString(tipo)}» no tiene forma JSON${this.donde()}: se documenta como {}`, nodo);
            return {};
        }
        if (flags & F.Null) {
            return {type: "null"};
        }
        if (flags & (F.Undefined | F.Void | F.Never)) {
            return {};
        }
        if (flags & F.NonPrimitive) {
            return {type: "object"};
        }
        if (flags & (F.TypeParameter | F.Index | F.IndexedAccess | F.Conditional | F.Substitution)) {
            this.incidencia("aviso", `«${this.typeChecker.typeToString(tipo)}» es un tipo sin instanciar${this.donde()}: se documenta como {}`, nodo);
            return {};
        }

        return undefined;
    }

    /**
     * Tipos con `toJSON(): R`: lo que se serializa es `R`. `Date` es una cadena `date-time`.
     */
    private viaToJSON(tipo: ts.Type, nodo: ts.Node): ISchema | undefined {
        if (esDate(tipo)) {
            return {type: "string", format: "date-time"};
        }
        const propiedad = tipo.getProperty("toJSON");
        if (propiedad === undefined) {
            return undefined;
        }
        const firma = this.typeChecker.getTypeOfSymbolAtLocation(propiedad, nodo).getCallSignatures()[0];
        if (firma === undefined) {
            return undefined;
        }
        const retorno = this.typeChecker.getReturnTypeOfSignature(firma);
        if (retorno === tipo) {
            return undefined;
        }

        return this.esquemaDe(retorno, nodo);
    }

    /**
     * Motivo por el que un tipo objeto no se puede describir, o `undefined` si sí.
     */
    private noRepresentable(tipo: ts.Type): string | undefined {
        const simbolo = tipo.getSymbol();
        const nombre = simbolo?.getName() ?? "";
        if (NO_REPRESENTABLES.has(nombre) || TYPED_ARRAY.test(nombre)) {
            return `«${nombre}»`;
        }
        if (simbolo !== undefined && (simbolo.flags & ts.SymbolFlags.Class) && this.typeChecker.getPropertiesOfType(tipo).some(p => (p.flags & ts.SymbolFlags.Accessor) !== 0)) {
            return `la clase «${nombre}» (tiene getters)`;
        }
        if (this.esFuncion(tipo)) {
            return "una función";
        }

        return undefined;
    }

    private esFuncion(tipo: ts.Type): boolean {
        return (tipo.flags & ts.TypeFlags.Object) !== 0
            && (tipo.getCallSignatures().length > 0 || tipo.getConstructSignatures().length > 0)
            && this.typeChecker.getPropertiesOfType(tipo).length === 0;
    }

    /**
     * Símbolo con el que se registra el tipo como componente, o `undefined` si va en línea.
     */
    private simboloDeComponente(tipo: ts.Type): ts.Symbol | undefined {
        if (tipo.aliasSymbol !== undefined && (tipo.aliasTypeArguments?.length ?? 0) === 0) {
            return tipo.aliasSymbol;
        }
        const simbolo = tipo.getSymbol();
        if (simbolo === undefined) {
            return undefined;
        }
        if (tipo.isUnion() && (tipo.flags & ts.TypeFlags.EnumLiteral) && (simbolo.flags & ts.SymbolFlags.Enum)) {
            return simbolo;
        }
        if (!(tipo.flags & ts.TypeFlags.Object) || simbolo.getName().startsWith("__") || (simbolo.declarations?.length ?? 0) === 0) {
            return undefined;
        }
        const generico = (tipo as ts.InterfaceType).typeParameters;
        const instanciado = ((tipo as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0 && this.typeChecker.getTypeArguments(tipo as ts.TypeReference).length > 0;
        if ((generico?.length ?? 0) > 0 || instanciado) {
            return undefined;
        }

        return simbolo;
    }

    private asignarNombre(simbolo: ts.Symbol): string {
        let base = simbolo.getName().replace(/[^A-Za-z0-9._-]/g, "_");
        if (base.startsWith("RespuestaOK_")) {
            // `RespuestaOK_*` son los envoltorios que genera `openapi.ts`.
            base = `Tipo_${base}`;
        }
        let nombre = base;
        if (this.ocupados.has(nombre)) {
            const fichero = simbolo.declarations?.[0]?.getSourceFile().fileName ?? "";
            const prefijo = this.raiz.endsWith("/") ? this.raiz : `${this.raiz}/`;
            const relativo = (fichero.startsWith(prefijo) ? fichero.slice(prefijo.length) : fichero).replace(/\.[^./]+$/, "");
            const sufijo = relativo.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
            nombre = `${base}_${sufijo}`;
            for (let i = 2; this.ocupados.has(nombre); i++) {
                nombre = `${base}_${sufijo}_${i}`;
            }
        }
        this.ocupados.add(nombre);

        return nombre;
    }

    /**
     * Esquema de la estructura de un tipo, sin registrarlo.
     */
    private construir(tipo: ts.Type, nodo: ts.Node): ISchema {
        if (this.pila.includes(tipo)) {
            this.incidencia("aviso", `tipo recursivo sin nombre${this.donde()}: se documenta como {}`, nodo);
            return {};
        }

        this.pila.push(tipo);
        try {
            if (tipo.isUnion()) {
                return this.union(tipo, nodo);
            }
            if (tipo.isIntersection()) {
                const primitivo = tipo.types.find(t => (t.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike)) !== 0);

                return primitivo === undefined ? this.objeto(tipo, nodo) : this.esquemaDe(primitivo, nodo);
            }
            if (this.typeChecker.isArrayType(tipo)) {
                const [elemento] = this.typeChecker.getTypeArguments(tipo as ts.TypeReference);

                return {type: "array", items: elemento === undefined ? {} : this.esquemaDe(elemento, nodo)};
            }
            if (this.typeChecker.isTupleType(tipo)) {
                const objetivo = (tipo as ts.TypeReference).target as ts.TupleType;
                if (objetivo.elementFlags.some(f => (f & (ts.ElementFlags.Rest | ts.ElementFlags.Variadic)) !== 0)) {
                    this.incidencia("aviso", `tupla con elementos rest${this.donde()}: se documentan solo sus posiciones fijas`, nodo);
                }

                return {type: "array", prefixItems: this.typeChecker.getTypeArguments(tipo as ts.TypeReference).map(t => this.esquemaDe(t, nodo))};
            }

            return this.objeto(tipo, nodo);
        } finally {
            this.pila.pop();
        }
    }

    private union(tipo: ts.UnionType, nodo: ts.Node): ISchema {
        const literales = new Map<"string" | "number", (string | number)[]>();
        const otros: ts.Type[] = [];
        let nulo = false;
        let verdadero = false;
        let falso = false;
        for (const parte of tipo.types) {
            const {flags} = parte;
            if (flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Never)) {
                continue;
            }
            if (flags & ts.TypeFlags.Null) {
                nulo = true;
            } else if (flags & ts.TypeFlags.BooleanLiteral) {
                if (this.typeChecker.typeToString(parte) === "true") {
                    verdadero = true;
                } else {
                    falso = true;
                }
            } else if (flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral)) {
                const base = flags & ts.TypeFlags.StringLiteral ? "string" : "number";
                const valores = literales.get(base) ?? [];
                valores.push((parte as ts.LiteralType).value as string | number);
                literales.set(base, valores);
            } else {
                otros.push(parte);
            }
        }

        const alternativas: ISchema[] = [];
        for (const [base, valores] of literales) {
            // `tipo.types` va por id interno del tipo, que depende de qué se haya resuelto antes: se ordena para que
            // el hash del documento no dependa de eso.
            valores.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            alternativas.push(valores.length === 1 ? {type: base, const: valores[0]} : {type: base, enum: valores});
        }
        if (verdadero && falso) {
            alternativas.push({type: "boolean"});
        } else if (verdadero || falso) {
            alternativas.push({type: "boolean", const: verdadero});
        }
        // Convertir una alternativa puede registrar componentes, y el primero en registrarse se queda el nombre limpio.
        // En `tipo.types` mandan los ids internos, que dependen de lo que el checker resolvió antes (también código
        // privado o ajeno a la API): se convierten en el orden de sus declaraciones.
        const claves = new Map(otros.map(t => [t, this.claveDeOrden(t)] as const));
        otros.sort((a, b) => {
            const [x, y] = [claves.get(a) as string, claves.get(b) as string];

            return x < y ? -1 : x > y ? 1 : 0;
        });
        for (const parte of otros) {
            alternativas.push(this.esquemaDe(parte, nodo));
        }
        const formas = new Map(alternativas.map(a => [a, canonico(a)] as const));
        alternativas.sort((a, b) => {
            const [x, y] = [formas.get(a) as string, formas.get(b) as string];

            return x < y ? -1 : x > y ? 1 : 0;
        });

        if (alternativas.length === 0) {
            return nulo ? {type: "null"} : {};
        }
        if (!nulo) {
            return alternativas.length === 1 ? alternativas[0] : {anyOf: alternativas};
        }

        return conNulo(alternativas);
    }

    /**
     * Clave estable para ordenar las alternativas de una unión: fichero y posición de su declaración, el texto del
     * tipo y, entre `<...>`, las claves de sus argumentos de tipo (o de sus miembros, si es una unión o una
     * intersección). Sin los argumentos, `IA[]` e `IB[]` —o `ICaja<IA>` e `ICaja<IB>`— empatarían cuando `IA` e `IB`
     * se escriben igual: comparten declaración (`Array`, `ICaja`) y texto.
     *
     * @param tipo  - Tipo a ordenar.
     * @param nivel - Profundidad de la recursión; a partir de 8 no se baja más.
     */
    private claveDeOrden(tipo: ts.Type, nivel = 0): string {
        let argumentos: readonly ts.Type[] = [];
        if (nivel < 8) {
            if (tipo.aliasSymbol !== undefined) {
                argumentos = tipo.aliasTypeArguments ?? [];
            } else if (((tipo as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0) {
                argumentos = this.typeChecker.getTypeArguments(tipo as ts.TypeReference);
            } else if (tipo.isUnionOrIntersection()) {
                argumentos = tipo.types;
            }
        }
        const hijas = argumentos.map(t => this.claveDeOrden(t, nivel + 1));
        if (tipo.isUnion()) {
            // Los miembros de una unión también van por id interno.
            hijas.sort();
        }
        const texto = `${this.typeChecker.typeToString(tipo)}<${hijas.join("|")}>`;
        const declaracion = (tipo.aliasSymbol ?? tipo.getSymbol())?.declarations?.[0];
        if (declaracion === undefined) {
            return `~${texto}`;
        }

        return `${declaracion.getSourceFile().fileName}:${String(declaracion.getStart()).padStart(9, "0")}:${texto}`;
    }

    private objeto(tipo: ts.Type, nodo: ts.Node): ISchema {
        const propiedades = this.propiedades(tipo, nodo);
        const esquema: ISchema = {type: "object"};
        if (propiedades.length > 0) {
            esquema.properties = {};
            for (const p of propiedades) {
                esquema.properties[p.nombre] = decorar(p.schema, p.description, p.deprecated);
            }
        }
        const obligatorias = propiedades.filter(p => p.required).map(p => p.nombre);
        if (obligatorias.length > 0) {
            esquema.required = obligatorias;
        }

        const indices = this.typeChecker.getIndexInfosOfType(tipo);
        const indice = indices.find(i => (i.keyType.flags & ts.TypeFlags.String) !== 0) ?? indices.find(i => (i.keyType.flags & ts.TypeFlags.Number) !== 0);
        if (indice !== undefined) {
            esquema.additionalProperties = this.esquemaDe(indice.type, nodo);
        }

        return esquema;
    }

    private propiedades(tipo: ts.Type, nodo: ts.Node): IPropiedad[] {
        const salida: IPropiedad[] = [];
        for (const propiedad of this.typeChecker.getPropertiesOfType(tipo)) {
            const nombre = propiedad.getName();
            if ((propiedad.flags & ts.SymbolFlags.Method) || nombre.startsWith("__@") || nombre.startsWith("#") || esPrivada(propiedad)) {
                continue;
            }
            const tipoPropiedad = this.typeChecker.getTypeOfSymbolAtLocation(propiedad, nodo);
            if ((tipoPropiedad.flags & ts.TypeFlags.Never) || this.esFuncion(this.typeChecker.getNonNullableType(tipoPropiedad))) {
                continue;
            }

            this.ruta.push(nombre);
            try {
                salida.push({
                    nombre,
                    schema: this.esquemaDe(tipoPropiedad, nodo),
                    required: !(propiedad.flags & ts.SymbolFlags.Optional) && !this.admiteUndefined(tipoPropiedad),
                    description: this.jsdoc.descripcionDePropiedad(propiedad),
                    deprecated: this.jsdoc.esDeprecated(propiedad),
                });
            } finally {
                this.ruta.pop();
            }
        }

        return salida;
    }

    private donde(): string {
        return this.ruta.length === 0 ? "" : ` en «${this.ruta.join(".")}»`;
    }

    private incidencia(severidad: TSeveridad, mensaje: string, nodo: ts.Node): void {
        const ubicacion = ubicacionDe(nodo, this.raiz);
        const clave = `${severidad}|${mensaje}|${ubicacion}`;
        if (!this.vistos.has(clave)) {
            this.vistos.add(clave);
            this.avisos.push({severidad, mensaje, ubicacion});
        }
    }
}

function esDate(tipo: ts.Type): boolean {
    const simbolo = tipo.getSymbol();

    return simbolo?.getName() === "Date" && (simbolo.declarations ?? []).some(d => /\/lib\.[^/]*\.d\.ts$/.test(d.getSourceFile().fileName));
}

function esPrivada(propiedad: ts.Symbol): boolean {
    return (propiedad.declarations ?? []).some(d => (ts.getCombinedModifierFlags(d) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !== 0);
}

/**
 * Añade `description` y `deprecated` a un esquema sin modificar el original (que puede ser un `$ref` compartido).
 */
function decorar(esquema: ISchema, descripcion: string | undefined, deprecated: boolean): ISchema {
    if (descripcion === undefined && !deprecated) {
        return esquema;
    }
    const salida: ISchema = {...esquema};
    if (descripcion !== undefined) {
        salida.description = descripcion;
    }
    if (deprecated) {
        salida.deprecated = true;
    }

    return salida;
}

/**
 * Añade `null` a las alternativas de una unión: en el `type` si hay una sola con tipo simple; si no, como
 * alternativa más.
 */
function conNulo(alternativas: ISchema[]): ISchema {
    if (alternativas.length > 1) {
        return {anyOf: [...alternativas, {type: "null"}]};
    }

    const [unica] = alternativas;
    if (typeof unica.type !== "string" || unica.$ref !== undefined) {
        return Object.keys(unica).length === 0 ? unica : {anyOf: [unica, {type: "null"}]};
    }

    const salida: ISchema = {...unica, type: [unica.type, "null"]};
    if (unica.enum !== undefined) {
        salida.enum = [...unica.enum, null];
    } else if ("const" in unica) {
        delete salida.const;
        salida.enum = [unica.const, null];
    }

    return salida;
}
