/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: e46b6449778ebb009826fa8716866238
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import ts from "typescript";

import type {IAviso} from "./avisos";
import type {IContratoLeido, IParametroTipado} from "./modelo";
import {buscarPropiedad, resolverExpresion} from "./ast";
import {tsToJSON, tsToString} from "./literal";
import {type GeneradorEsquemas} from "./esquema";
import {ubicacionDe} from "./avisos";

/** Claves de `IContractTypes`. */
const CLAVES_TIPOS = ["post", "response", "query", "headers"];

/** Claves de `IContractConfig`. */
const CLAVES_CONFIG = ["errors", "description", "envelope"];

/**
 * Lo que necesita la lectura de un contrato.
 *
 * @property typeChecker - Checker del programa.
 * @property raiz        - Raíz del monorepo.
 * @property avisos      - Lista donde se acumulan las incidencias.
 * @property generador   - Generador de esquemas del servicio.
 * @property grupo       - Nombre del grupo, para los mensajes.
 */
export interface IContextoContrato {
    typeChecker: ts.TypeChecker;
    raiz: string;
    avisos: IAviso[];
    generador: GeneradorEsquemas;
    grupo: string;
}

/**
 * Lee el `contract` de una expresión o de un bloque (`Contract<T>({...})` de `@mr/core-network`).
 *
 * Los tipos salen del type checker: el tipo de la expresión es `IContract<T>` y `T` está en su propiedad
 * fantasma `types`, así que da igual que el contrato esté escrito en línea, en una `const` o importado. La
 * configuración (`errors`, `description`, `envelope`) sale del literal que se pasa a la llamada.
 *
 * @param nodo     - Expresión del campo `contract`.
 * @param contexto - Checker, generador de esquemas y lista de avisos.
 */
export function leerContrato(nodo: ts.Expression, contexto: IContextoContrato): IContratoLeido {
    const {typeChecker, raiz, avisos, generador, grupo} = contexto;
    const aviso = (mensaje: string, donde: ts.Node = nodo): void => {
        avisos.push({severidad: "aviso", mensaje: `${grupo}: ${mensaje}`, ubicacion: ubicacionDe(donde, raiz)});
    };

    const contrato: IContratoLeido = {postOpcional: false, respuestaOpcional: false, errores: [], envoltorio: true};

    const propiedadTipos = typeChecker.getTypeAtLocation(nodo).getProperty("types");
    if (propiedadTipos === undefined) {
        aviso("el campo «contract» no es un Contract<T>() (su tipo no tiene «types»): se ignora");
        return contrato;
    }

    const tipos = typeChecker.getNonNullableType(typeChecker.getTypeOfSymbolAtLocation(propiedadTipos, nodo));
    for (const clave of typeChecker.getPropertiesOfType(tipos)) {
        const nombre = clave.getName();
        const opcional = (clave.flags & ts.SymbolFlags.Optional) !== 0;
        const tipo = typeChecker.getTypeOfSymbolAtLocation(clave, nodo);
        if (!CLAVES_TIPOS.includes(nombre)) {
            aviso(`«${nombre}» no es una clave de los tipos del contract (válidas: ${CLAVES_TIPOS.join(", ")}): se ignora`);
            continue;
        }
        if (tipo.flags & ts.TypeFlags.Unknown) {
            continue;
        }

        if (nombre === "response") {
            contrato.respuestaOpcional = generador.admiteUndefined(tipo) || opcional;
            if (!(tipo.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined))) {
                contrato.respuesta = generador.esquemaDe(tipo, nodo);
            }
        } else if (nombre === "post") {
            contrato.postOpcional = generador.admiteUndefined(tipo) || opcional;
            contrato.post = generador.esquemaDe(tipo, nodo);
        } else {
            const parametros: IParametroTipado[] | undefined = generador.parametrosDe(tipo, nodo);
            if (parametros !== undefined) {
                contrato[nombre as "query" | "headers"] = parametros;
            }
        }
    }

    leerConfiguracion(nodo, contrato, contexto, aviso);

    return contrato;
}

function leerConfiguracion(nodo: ts.Expression, contrato: IContratoLeido, contexto: IContextoContrato, aviso: (mensaje: string, donde?: ts.Node) => void): void {
    const {typeChecker} = contexto;
    const resuelto = resolverExpresion(nodo, typeChecker);
    let config: ts.Expression | undefined = resuelto;
    if (ts.isCallExpression(resuelto)) {
        config = resuelto.arguments[0] === undefined ? undefined : resolverExpresion(resuelto.arguments[0], typeChecker);
    }
    if (config === undefined) {
        return;
    }
    if (!ts.isObjectLiteralExpression(config)) {
        aviso("la configuración del contract no es un objeto literal: se ignora", config);
        return;
    }

    for (const propiedad of config.properties) {
        const nombre = propiedad.name !== undefined && (ts.isIdentifier(propiedad.name) || ts.isStringLiteral(propiedad.name)) ? propiedad.name.text : undefined;
        if (nombre !== undefined && !CLAVES_CONFIG.includes(nombre)) {
            aviso(`«${nombre}» no es una clave del contract (válidas: ${CLAVES_CONFIG.join(", ")}): se ignora`, propiedad);
        }
    }

    const errores = buscarPropiedad(config, "errors");
    if (errores !== undefined) {
        const valor = tsToJSON(errores, typeChecker);
        if (!Array.isArray(valor)) {
            aviso("«errors» no es un array literal de códigos: se ignora", errores);
        } else {
            for (const codigo of valor) {
                if (typeof codigo !== "number" || !Number.isInteger(codigo) || codigo < 400 || codigo > 599) {
                    aviso(`«${String(codigo)}» no es un código de error HTTP (400-599): se ignora`, errores);
                } else if (!contrato.errores.includes(codigo)) {
                    contrato.errores.push(codigo);
                }
            }
        }
    }

    const descripcion = buscarPropiedad(config, "description");
    if (descripcion !== undefined) {
        contrato.descripcion = tsToString(descripcion, typeChecker);
        if (contrato.descripcion === undefined) {
            aviso("«description» no es una cadena literal: se ignora", descripcion);
        }
    }

    const envoltorio = buscarPropiedad(config, "envelope");
    if (envoltorio !== undefined) {
        const valor = tsToJSON(envoltorio, typeChecker);
        if (typeof valor === "boolean") {
            contrato.envoltorio = valor;
        } else {
            aviso("«envelope» no es un booleano literal: se asume true", envoltorio);
        }
    }
}
