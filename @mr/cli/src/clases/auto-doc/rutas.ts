/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 11:55:33 GMT
 * Hash: 84205eb032e8b216a1f3f7a383f58488
 * Versión: 2026.11.12+1-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import ts from "typescript";

import type {IContratoLeido, IEsquema, IGrupoRutas, IOperacionRuta, IResultadoRutas, TMetodoOpenAPI} from "./modelo";
import {type IAviso, ubicacionDe} from "./avisos";
import {buscarPropiedad, resolverExpresion} from "./ast";
import {tsToJSON, tsToString} from "./literal";
import {GeneradorEsquemas} from "./esquema";
import {compararParaNombres} from "./visibilidad";
import {leerContrato} from "./contrato";

/** Fichero donde vive `RouteGroup`; se compara con el final de la ruta para no depender de dónde esté instalado. */
export const FICHERO_ROUTE_GROUP = "/server/http/routes/group/index.ts";

/** Grupos que nunca se documentan, por nombre de clase. Red de seguridad: lo normal es `documentable: false`. */
const GRUPOS_EXCLUIDOS = [
    "RouteGroupError",
    "Admin",
    "Favicon",
];

/** Métodos que no llevan cuerpo: un `contract.post` en ellos no se documenta. */
const METODOS_SIN_CUERPO: TMetodoOpenAPI[] = ["get", "head", "options"];

/** Métodos que se documentan cuando una expresión acepta cualquiera (`ALL` o sin `metodos`). */
const METODOS_TODOS: TMetodoOpenAPI[] = ["get", "post", "put", "patch", "delete"];

const METODOS_VALIDOS: TMetodoOpenAPI[] = ["get", "post", "put", "patch", "delete", "head", "options"];

/**
 * Recorre el programa y extrae los grupos de rutas (clases que, directa o indirectamente, extienden
 * `RouteGroup`) con sus operaciones.
 *
 * Se documenta todo salvo: grupos o bloques con `documentable: false` (en el bloque o en el segundo argumento
 * del `super()`), y grupos de la lista de exclusión. Las expresiones `internal: true` se documentan y se marcan. Lo que no se puede leer de
 * forma estática (un `getHandlers` que no devuelve un array literal, un `resumen` calculado...) se informa como
 * aviso con su ubicación en vez de descartarse en silencio.
 *
 * Los contratos se leen al final, cuando ya se conocen todas las operaciones, y en el orden de
 * {@link compararParaNombres}: primero los de las operaciones públicas y después los del resto. Los esquemas toman
 * el nombre limpio por orden de llegada, así que un tipo público nunca cede su nombre a un homónimo que solo usan
 * operaciones privadas, y añadir, quitar o mover operaciones privadas no renombra nada de lo público.
 *
 * @param program - Programa TypeScript del servicio.
 * @param raiz    - Raíz del monorepo, para escribir las ubicaciones de los avisos.
 */
export function extraerRutas(program: ts.Program, raiz: string): IResultadoRutas {
    const typeChecker = program.getTypeChecker();
    const grupos: IGrupoRutas[] = [];
    const avisos: IAviso[] = [];
    const vistas = new Map<string, string>();
    const generador = new GeneradorEsquemas(typeChecker, raiz, avisos);
    const contratos = new Map<ts.Node, IContratoLeido>();
    const pendientes: IPendiente[] = [];

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) {
            continue;
        }

        ts.forEachChild(sourceFile, (node) => {
            if (!ts.isClassDeclaration(node) || !node.name) {
                return;
            }
            const homonimos: string[] = [];
            if (!esRouteGroup(typeChecker.getTypeAtLocation(node), typeChecker, new Set(), homonimos)) {
                if (homonimos.length > 0) {
                    avisos.push({severidad: "aviso", mensaje: `${node.name.text} extiende una clase «RouteGroup» declarada en ${homonimos[0]}, que no es la de @mr/core-network: no se documenta`, ubicacion: ubicacionDe(node, raiz)});
                }
                return;
            }

            const nombre = node.name.text;
            if (GRUPOS_EXCLUIDOS.includes(nombre) || !grupoDocumentable(node, typeChecker)) {
                return;
            }

            const grupo: IGrupoRutas = {nombre, operaciones: []};
            grupos.push(grupo);

            const contexto: IContexto = {typeChecker, raiz, avisos, vistas, grupo, generador, contratos, pendientes};
            leerGrupo(node, contexto);
        });
    }

    for (const pendiente of [...pendientes].sort(compararPendientes)) {
        pendiente.leer();
    }
    for (const pendiente of pendientes) {
        pendiente.completar();
    }

    return {grupos, avisos, componentes: generador.componentes};
}

/**
 * Lo que necesita la lectura de un grupo.
 *
 * @property typeChecker - Checker del programa.
 * @property raiz        - Raíz del monorepo.
 * @property avisos      - Lista donde se acumulan las incidencias.
 * @property vistas      - Operaciones ya registradas (`método path` → ubicación) para detectar duplicados.
 * @property grupo       - Grupo al que se añaden las operaciones.
 * @property generador   - Generador de esquemas del servicio (los tipos de los contratos).
 * @property contratos   - Contratos ya leídos por su nodo, para no repetirlo en cada expresión de un bloque.
 * @property pendientes  - Expresiones cuyo contrato falta por leer (ver {@link IPendiente}).
 */
interface IContexto {
    typeChecker: ts.TypeChecker;
    raiz: string;
    avisos: IAviso[];
    vistas: Map<string, string>;
    grupo: IGrupoRutas;
    generador: GeneradorEsquemas;
    contratos: Map<ts.Node, IContratoLeido>;
    pendientes: IPendiente[];
}

/**
 * Una expresión ya leída a la que le falta el contrato. Se deja para el final porque el orden en que se leen los
 * contratos decide qué tipo se queda el nombre limpio (ver {@link extraerRutas}).
 *
 * @property primera   - La primera de sus operaciones según {@link compararParaNombres}; `undefined` si no tiene
 *                       ninguna (todas estaban repetidas).
 * @property leer      - Lee el contrato (una sola vez por nodo) y registra sus tipos en el generador.
 * @property completar - Pone el contrato en las operaciones y emite los avisos que dependen de él.
 */
interface IPendiente {
    primera?: IOperacionRuta;
    leer: () => IContratoLeido | undefined;
    completar: () => void;
}

/**
 * Orden de lectura de los contratos: el de la primera operación de cada expresión; las que no tienen operaciones, al
 * final. `sort` es estable, así que lo que empata se queda en el orden del código.
 */
function compararPendientes(a: IPendiente, b: IPendiente): number {
    if (a.primera === undefined || b.primera === undefined) {
        return Number(a.primera === undefined) - Number(b.primera === undefined);
    }

    return compararParaNombres(a.primera, b.primera);
}

/**
 * `true` si el tipo hereda, a cualquier profundidad, de la clase `RouteGroup` de `@mr/core-network`. Se
 * comprueba el símbolo y el fichero donde se declara: una clase propia que se llame igual no cuenta, pero se
 * anota en `homonimos` (fichero de declaración) para avisar de que se ha descartado.
 */
function esRouteGroup(type: ts.Type, typeChecker: ts.TypeChecker, vistos: Set<ts.Type>, homonimos: string[]): boolean {
    if (vistos.has(type) || !(type.flags & ts.TypeFlags.Object)) {
        return false;
    }
    vistos.add(type);

    const objeto = type as ts.ObjectType;
    const objetivo = (objeto.objectFlags & ts.ObjectFlags.Reference) ? (objeto as ts.TypeReference).target : objeto;
    if (!(objetivo.objectFlags & (ts.ObjectFlags.Class | ts.ObjectFlags.Interface))) {
        return false;
    }

    for (const base of typeChecker.getBaseTypes(objetivo as ts.InterfaceType)) {
        const simbolo = base.getSymbol();
        if (simbolo?.getName() === "RouteGroup" && simbolo.declarations?.some(d => d.getSourceFile().fileName.endsWith(FICHERO_ROUTE_GROUP))) {
            return true;
        }
        if (simbolo?.getName() === "RouteGroup") {
            homonimos.push(simbolo.declarations?.[0]?.getSourceFile().fileName ?? "?");
        }
        if (esRouteGroup(base, typeChecker, vistos, homonimos)) {
            return true;
        }
    }

    return false;
}

/**
 * `false` si el constructor de la clase llama a `super(config, {documentable: false})`.
 */
function grupoDocumentable(clase: ts.ClassDeclaration, typeChecker: ts.TypeChecker): boolean {
    const constructor = clase.members.find(ts.isConstructorDeclaration);
    for (const sentencia of constructor?.body?.statements ?? []) {
        if (!ts.isExpressionStatement(sentencia) || !ts.isCallExpression(sentencia.expression) || sentencia.expression.expression.kind !== ts.SyntaxKind.SuperKeyword) {
            continue;
        }
        const params = sentencia.expression.arguments[1];
        const objeto = params === undefined ? undefined : resolverExpresion(params, typeChecker);
        const valor = objeto !== undefined && ts.isObjectLiteralExpression(objeto) ? buscarPropiedad(objeto, "documentable") : undefined;
        if (valor !== undefined && tsToJSON(valor, typeChecker) === false) {
            return false;
        }
    }

    return true;
}

function leerGrupo(clase: ts.ClassDeclaration, contexto: IContexto): void {
    const metodo = clase.members.find((miembro): miembro is ts.MethodDeclaration =>
        ts.isMethodDeclaration(miembro) && ts.isIdentifier(miembro.name) && miembro.name.text === "getHandlers"
    );
    if (metodo?.body === undefined) {
        if (!clase.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword)) {
            contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre} no declara getHandlers: no se documenta ninguna ruta`, ubicacion: ubicacionDe(clase, contexto.raiz)});
        }
        return;
    }

    const retornos: ts.ReturnStatement[] = [];
    recogerRetornos(metodo.body, retornos);
    for (const retorno of retornos) {
        const valor = retorno.expression === undefined ? undefined : resolverExpresion(retorno.expression, contexto.typeChecker);
        if (valor === undefined || !ts.isArrayLiteralExpression(valor)) {
            contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}.getHandlers no devuelve un array literal: se omiten sus rutas`, ubicacion: ubicacionDe(retorno, contexto.raiz)});
            continue;
        }
        for (const elemento of valor.elements) {
            leerBloque(elemento, contexto);
        }
    }
}

function recogerRetornos(node: ts.Node, salida: ts.ReturnStatement[]): void {
    ts.forEachChild(node, (hijo) => {
        if (ts.isFunctionLike(hijo)) {
            return;
        }
        if (ts.isReturnStatement(hijo)) {
            salida.push(hijo);
            return;
        }
        recogerRetornos(hijo, salida);
    });
}

function leerBloque(elemento: ts.Expression, contexto: IContexto): void {
    const bloque = resolverExpresion(elemento, contexto.typeChecker);
    if (!ts.isObjectLiteralExpression(bloque)) {
        contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: un bloque de getHandlers no es un objeto literal: se omiten sus rutas`, ubicacion: ubicacionDe(elemento, contexto.raiz)});
        return;
    }

    const documentable = buscarPropiedad(bloque, "documentable");
    if (documentable !== undefined && tsToJSON(documentable, contexto.typeChecker) === false) {
        return;
    }

    const contratoBloque = buscarPropiedad(bloque, "contract");

    const expresiones = buscarPropiedad(bloque, "expresiones");
    const lista = expresiones === undefined ? undefined : resolverExpresion(expresiones, contexto.typeChecker);
    if (lista === undefined || !ts.isArrayLiteralExpression(lista)) {
        contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «expresiones» no es un array literal: se omiten sus rutas`, ubicacion: ubicacionDe(expresiones ?? bloque, contexto.raiz)});
        return;
    }

    for (const expresion of lista.elements) {
        leerExpresion(expresion, contexto, contratoBloque);
    }
}

function leerExpresion(elemento: ts.Expression, contexto: IContexto, contratoBloque: ts.Expression | undefined): void {
    const {typeChecker, raiz, avisos} = contexto;
    const expresion = resolverExpresion(elemento, typeChecker);
    const ubicacion = ubicacionDe(elemento, raiz);
    if (!ts.isObjectLiteralExpression(expresion)) {
        avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: una expresión no es un objeto literal: se omite`, ubicacion});
        return;
    }

    const propiedad = (nombre: string): ts.Expression | undefined => buscarPropiedad(expresion, nombre);
    const internal = leerInternal(propiedad("internal"), contexto, ubicacion);

    const exact = propiedad("exact");
    const resumen = propiedad("resumen");
    const textoResumen = resumen === undefined ? undefined : tsToString(resumen, typeChecker);
    const textoExact = exact === undefined ? undefined : tsToString(exact, typeChecker);
    const path = textoExact ?? textoResumen;
    if (path === undefined) {
        avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: ni «exact» ni «resumen» son literales: se omite la ruta`, ubicacion});
        return;
    }
    const texto = path.trim();
    if (!texto.startsWith("/") && /[\\^$]/.test(texto)) {
        avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «${texto}» no es un path (no empieza por «/» y parece una expresión regular): se omite la ruta`, ubicacion});
        return;
    }
    let conBarra = texto;
    if (!texto.startsWith("/")) {
        conBarra = `/${texto}`;
        avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «${texto}» no empieza por «/»: se documenta como «${conBarra}»`, ubicacion});
    }
    const {path: normalizado, query: parametrosQuery} = separarQuery(conBarra);
    if (parametrosQuery !== undefined) {
        avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «${conBarra}» lleva query string: se documenta «${normalizado}» y los parámetros pasan a query`, ubicacion});
    }

    const metodos = leerMetodos(propiedad("metodos"), contexto, ubicacion);
    const deprecated = propiedad("deprecated");
    const documentacion = propiedad("documentacion");
    const objetoDoc = documentacion === undefined ? undefined : resolverExpresion(documentacion, typeChecker);
    const descripcion = objetoDoc !== undefined && ts.isObjectLiteralExpression(objetoDoc) ? tsToString(buscarPropiedad(objetoDoc, "descripcion") ?? objetoDoc, typeChecker) : undefined;

    const query = leerSpec(propiedad("query"), "query", contexto);
    const headers = leerSpec(propiedad("headers"), "headers", contexto);
    const post = leerSpec(propiedad("post"), "post", contexto);
    const response = leerSpec(propiedad("response"), "response", contexto);

    const operaciones: IOperacionRuta[] = [];
    for (const variante of expandirOpcionales(normalizado)) {
        for (const metodo of metodos) {
            const clave = `${metodo} ${variante}`;
            const anterior = contexto.vistas.get(clave);
            if (anterior !== undefined) {
                avisos.push({severidad: "aviso", mensaje: `${metodo.toUpperCase()} ${variante} está repetida (ya declarada en ${anterior}): se documenta la primera`, ubicacion});
                continue;
            }
            contexto.vistas.set(clave, ubicacion);

            const operacion: IOperacionRuta = {
                metodo,
                path: variante,
                parametros: parametrosDe(variante),
                resumen: textoResumen ?? normalizado,
                descripcion,
                deprecated: deprecated !== undefined && tsToJSON(deprecated, typeChecker) === true,
                internal,
                query,
                headers,
                queryPath: parametrosQuery,
                post,
                response,
                contrato: undefined,
                ubicacion,
            };
            contexto.grupo.operaciones.push(operacion);
            operaciones.push(operacion);
        }
    }

    // El contrato de la expresión sustituye al del bloque. Se lee al final (ver `extraerRutas`).
    const nodoContrato = propiedad("contract") ?? contratoBloque;
    const leer = (): IContratoLeido | undefined => (nodoContrato === undefined ? undefined : contratoDe(nodoContrato, contexto));
    const completar = (): void => {
        const contrato = leer();
        const cabeceras = contrato?.headers?.map(h => h.nombre) ?? Object.keys(headers ?? {});
        for (const cabecera of cabeceras) {
            if (["accept", "content-type"].includes(cabecera.toLowerCase())) {
                avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «${normalizado}» declara la cabecera «${cabecera}», que OpenAPI ignora como parámetro: no se documenta`, ubicacion});
            }
        }
        if (contrato?.post !== undefined && metodos.some(m => METODOS_SIN_CUERPO.includes(m))) {
            avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «${normalizado}» tiene contract.post pero acepta GET/HEAD/OPTIONS, que no llevan cuerpo: solo se documenta en los demás métodos`, ubicacion});
        }
        for (const operacion of operaciones) {
            operacion.contrato = contrato;
            operacion.descripcion = contrato?.descripcion ?? descripcion;
        }
    };
    const primera = operaciones.reduce<IOperacionRuta | undefined>((menor, o) => (menor === undefined || compararParaNombres(o, menor) < 0 ? o : menor), undefined);
    contexto.pendientes.push({primera, leer, completar});
}

function contratoDe(nodo: ts.Expression, contexto: IContexto): IContratoLeido {
    let contrato = contexto.contratos.get(nodo);
    if (contrato === undefined) {
        const {typeChecker, raiz, avisos, generador} = contexto;
        contrato = leerContrato(nodo, {typeChecker, raiz, avisos, generador, grupo: contexto.grupo.nombre});
        contexto.contratos.set(nodo, contrato);
    }

    return contrato;
}

/**
 * Valor de `internal`. Si no se puede leer como booleano (`!PRODUCCION`, un ternario...), la ruta se documenta como
 * interna y se avisa: tomarla por pública la sacaría en el documento `public` sin que nadie lo hubiera decidido.
 */
function leerInternal(nodo: ts.Expression | undefined, contexto: IContexto, ubicacion: string): boolean {
    if (nodo === undefined) {
        return false;
    }
    const valor = tsToJSON(nodo, contexto.typeChecker);
    if (typeof valor === "boolean") {
        return valor;
    }
    contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «internal» no es un booleano literal: se documenta como interna`, ubicacion});

    return true;
}

function leerMetodos(nodo: ts.Expression | undefined, contexto: IContexto, ubicacion: string): TMetodoOpenAPI[] {
    if (nodo === undefined) {
        return METODOS_TODOS;
    }
    const valor = tsToJSON(nodo, contexto.typeChecker);
    if (!Array.isArray(valor)) {
        contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «metodos» no es un array literal: se asumen todos`, ubicacion});
        return METODOS_TODOS;
    }

    const salida: TMetodoOpenAPI[] = [];
    for (const item of valor) {
        const metodo = typeof item === "string" ? item.toLowerCase() : "";
        if (metodo === "all") {
            return METODOS_TODOS;
        }
        if (!METODOS_VALIDOS.includes(metodo as TMetodoOpenAPI)) {
            contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: método «${String(item)}» desconocido: se ignora`, ubicacion});
            continue;
        }
        if (!salida.includes(metodo as TMetodoOpenAPI)) {
            salida.push(metodo as TMetodoOpenAPI);
        }
    }

    return salida.length === 0 ? METODOS_TODOS : salida;
}

function leerSpec(nodo: ts.Expression | undefined, nombre: string, contexto: IContexto): IEsquema | undefined {
    if (nodo === undefined) {
        return undefined;
    }
    const valor = tsToJSON(nodo, contexto.typeChecker);
    if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
        contexto.avisos.push({severidad: "aviso", mensaje: `${contexto.grupo.nombre}: «${nombre}» no es un objeto literal: se omite`, ubicacion: ubicacionDe(nodo, contexto.raiz)});
        return undefined;
    }

    return valor as IEsquema;
}

/**
 * Separa un path de su query string: corta en el primer `?` que no está dentro de `{...}` (el de `{x?}` es un
 * segmento opcional). Los nombres de la parte de query (`k=v&k2=v2`) se devuelven sin repetir.
 *
 * @param path - Path tal como está escrito en el código.
 */
export function separarQuery(path: string): {path: string, query?: string[]} {
    let profundidad = 0;
    for (let i = 0; i < path.length; i++) {
        const c = path[i];
        if (c === "{") {
            profundidad++;
        } else if (c === "}") {
            profundidad = Math.max(0, profundidad - 1);
        } else if (c === "?" && profundidad === 0) {
            const nombres: string[] = [];
            for (const par of path.slice(i + 1).split("&")) {
                const nombre = par.split("=")[0].trim();
                if (nombre !== "" && !nombres.includes(nombre)) {
                    nombres.push(nombre);
                }
            }

            return {path: path.slice(0, i), query: nombres};
        }
    }

    return {path};
}

/**
 * Nombres de los `{parametros}` de un path.
 */
export function parametrosDe(path: string): string[] {
    return [...path.matchAll(/\{([^}/]+)\}/g)].map(m => m[1]);
}

/**
 * Expande los segmentos opcionales `{x?}` de un path en las variantes que acepta de verdad: con el segmento
 * (`{x}`) y sin él. Con varios opcionales sale el producto de todas.
 *
 * @param path - Path tal como está escrito en el código.
 */
export function expandirOpcionales(path: string): string[] {
    const coincidencia = /(\/?)\{([^}/]+)\?\}/.exec(path);
    if (coincidencia === null) {
        return [path];
    }

    const antes = path.slice(0, coincidencia.index);
    const despues = path.slice(coincidencia.index + coincidencia[0].length);
    const con = `${antes}${coincidencia[1]}{${coincidencia[2]}}${despues}`;
    const sin = `${antes}${despues}`;

    return [...expandirOpcionales(con), ...expandirOpcionales(sin === "" ? "/" : sin)];
}
