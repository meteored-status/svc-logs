/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:12 GMT
 * Hash: 31789047faace5defd9a66cdcf17d447
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import ts from "typescript";

import type {JSONValue} from "./modelo";

/** Profundidad máxima de resolución (identificadores que apuntan a identificadores, objetos anidados...). */
const PROFUNDIDAD_MAX = 32;

/**
 * Convierte un nodo del AST de TypeScript a un valor JSON, resolviendo identificadores y accesos a
 * propiedad que apunten a constantes con inicializador.
 *
 * Entiende: literales (cadena, plantilla sin sustituciones, número, booleano, `null`, regex), números
 * negativos, plantillas y sumas de cadenas cuyas partes se resuelven, objetos (con `spread` y
 * propiedades abreviadas), arrays, `as const`/`satisfies`/paréntesis/`!`, `buildSpecification(x)`,
 * `new RegExp(...)`, identificadores de `const`, miembros de `enum` y propiedades de objetos constantes.
 * Las expresiones regulares se devuelven como su texto literal (`/patrón/flags`).
 *
 * @param node        - Nodo a convertir.
 * @param typeChecker - Checker del programa, para resolver identificadores.
 * @returns El valor JSON equivalente, o `null` si el nodo no se puede evaluar sin ejecutarlo.
 */
export function tsToJSON(node: ts.Node, typeChecker: ts.TypeChecker): JSONValue {
    return evaluar(node, typeChecker, 0);
}

/**
 * Evalúa un nodo y devuelve su valor solo si es una cadena.
 *
 * @param node        - Nodo a evaluar.
 * @param typeChecker - Checker del programa.
 */
export function tsToString(node: ts.Node, typeChecker: ts.TypeChecker): string | undefined {
    const valor = tsToJSON(node, typeChecker);

    return typeof valor === "string" ? valor : undefined;
}

/**
 * Separa el patrón de una expresión regular en su texto literal (`/patrón/flags`), sin barras ni flags.
 * Un texto que no tiene forma de literal se devuelve tal cual.
 *
 * @param texto - Texto literal de la regex.
 */
export function patronDeRegex(texto: string): string {
    if (texto.startsWith("/") && texto.lastIndexOf("/") > 0) {
        return texto.slice(1, texto.lastIndexOf("/"));
    }

    return texto;
}

function evaluar(node: ts.Node, typeChecker: ts.TypeChecker, profundidad: number): JSONValue {
    if (profundidad > PROFUNDIDAD_MAX) {
        return null;
    }
    const siguiente = profundidad + 1;

    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) {
        return evaluar(node.expression, typeChecker, siguiente);
    }
    if (ts.isObjectLiteralExpression(node)) {
        return evaluarObjeto(node, typeChecker, siguiente);
    }
    if (ts.isArrayLiteralExpression(node)) {
        return node.elements.map(el => evaluar(el, typeChecker, siguiente));
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }
    if (ts.isNumericLiteral(node)) {
        return Number(node.text);
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
    }
    if (ts.isRegularExpressionLiteral(node)) {
        return node.text;
    }
    if (ts.isPrefixUnaryExpression(node) && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)) {
        const valor = evaluar(node.operand, typeChecker, siguiente);

        return typeof valor === "number" ? (node.operator === ts.SyntaxKind.MinusToken ? -valor : valor) : null;
    }
    if (ts.isTemplateExpression(node)) {
        return evaluarPlantilla(node, typeChecker, siguiente);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const izquierda = evaluar(node.left, typeChecker, siguiente);
        const derecha = evaluar(node.right, typeChecker, siguiente);
        if (typeof izquierda === "number" && typeof derecha === "number") {
            return izquierda + derecha;
        }

        return esEscalar(izquierda) && esEscalar(derecha) ? `${izquierda}${derecha}` : null;
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "RegExp") {
        return evaluarRegExp(node, typeChecker, siguiente);
    }
    if (ts.isCallExpression(node)) {
        // Solo `buildSpecification(x)` es transparente: cualquier otra llamada se ejecutaría.
        const nombre = ts.isIdentifier(node.expression) ? node.expression.text : undefined;
        const arg = node.arguments[0];

        return nombre === "buildSpecification" && arg !== undefined ? evaluar(arg, typeChecker, siguiente) : null;
    }
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
        return resolverSimbolo(node, typeChecker, siguiente);
    }

    return null;
}

function esEscalar(valor: JSONValue): valor is string | number | boolean {
    return typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean";
}

function evaluarObjeto(node: ts.ObjectLiteralExpression, typeChecker: ts.TypeChecker, profundidad: number): JSONValue {
    const obj: {[key: string]: JSONValue} = {};
    node.properties.forEach(prop => {
        if (ts.isPropertyAssignment(prop)) {
            const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)
                ? prop.name.text
                : undefined;
            if (key !== undefined) {
                obj[key] = evaluar(prop.initializer, typeChecker, profundidad);
            }
        } else if (ts.isSpreadAssignment(prop)) {
            const spread = evaluar(prop.expression, typeChecker, profundidad);
            if (spread && typeof spread === "object" && !Array.isArray(spread)) {
                Object.assign(obj, spread);
            }
        } else if (ts.isShorthandPropertyAssignment(prop)) {
            obj[prop.name.text] = evaluarSimbolo(typeChecker.getShorthandAssignmentValueSymbol(prop), typeChecker, profundidad);
        }
    });

    return obj;
}

function evaluarPlantilla(node: ts.TemplateExpression, typeChecker: ts.TypeChecker, profundidad: number): JSONValue {
    let salida = node.head.text;
    for (const span of node.templateSpans) {
        const valor = evaluar(span.expression, typeChecker, profundidad);
        if (!esEscalar(valor)) {
            return null;
        }
        salida += `${valor}${span.literal.text}`;
    }

    return salida;
}

function evaluarRegExp(node: ts.NewExpression, typeChecker: ts.TypeChecker, profundidad: number): JSONValue {
    const [patron, flags] = node.arguments ?? [];
    if (patron === undefined) {
        return null;
    }
    const cuerpo = evaluar(patron, typeChecker, profundidad);
    const modificadores = flags === undefined ? "" : evaluar(flags, typeChecker, profundidad);
    if (typeof cuerpo !== "string" || typeof modificadores !== "string") {
        return null;
    }

    return `/${cuerpo}/${modificadores}`;
}

function resolverSimbolo(node: ts.Identifier | ts.PropertyAccessExpression, typeChecker: ts.TypeChecker, profundidad: number): JSONValue {
    if (ts.isIdentifier(node) && node.text === "undefined") {
        return null;
    }

    return evaluarSimbolo(typeChecker.getSymbolAtLocation(ts.isIdentifier(node) ? node : node.name), typeChecker, profundidad);
}

function evaluarSimbolo(simbolo: ts.Symbol | undefined, typeChecker: ts.TypeChecker, profundidad: number): JSONValue {
    let symbol = simbolo;
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
        symbol = typeChecker.getAliasedSymbol(symbol);
    }
    const declaracion = symbol?.valueDeclaration;
    if (declaracion === undefined) {
        return null;
    }
    if (ts.isVariableDeclaration(declaracion) && declaracion.initializer) {
        // Solo `const`: el valor de un `let`/`var` puede cambiar antes de usarse.
        if (!(ts.getCombinedNodeFlags(declaracion) & ts.NodeFlags.Const)) {
            return null;
        }

        return evaluar(declaracion.initializer, typeChecker, profundidad);
    }
    if (ts.isPropertyAssignment(declaracion)) {
        return evaluar(declaracion.initializer, typeChecker, profundidad);
    }
    if (ts.isEnumMember(declaracion)) {
        const valor = typeChecker.getConstantValue(declaracion);

        return valor === undefined ? null : valor;
    }

    return null;
}
