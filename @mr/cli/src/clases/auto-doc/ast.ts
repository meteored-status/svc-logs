/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: e52bbd2648408e860d902bfa1b9e8c7a
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import ts from "typescript";

/** Profundidad máxima al seguir identificadores hasta su inicializador. */
const SALTOS_MAX = 8;

/**
 * Valor de una propiedad de un objeto literal (`nombre: valor` o abreviada `nombre`).
 */
export function buscarPropiedad(objeto: ts.ObjectLiteralExpression, nombre: string): ts.Expression | undefined {
    for (const prop of objeto.properties) {
        if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) && prop.name.text === nombre) {
            return prop.initializer;
        }
        if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === nombre) {
            return prop.name;
        }
    }

    return undefined;
}

/**
 * Sigue paréntesis, `as`/`satisfies` e identificadores de variable `const` hasta la expresión que de verdad los define.
 */
export function resolverExpresion(nodo: ts.Expression, typeChecker: ts.TypeChecker): ts.Expression {
    let actual = nodo;
    for (let i = 0; i < SALTOS_MAX; i++) {
        if (ts.isParenthesizedExpression(actual) || ts.isAsExpression(actual) || ts.isSatisfiesExpression(actual) || ts.isNonNullExpression(actual)) {
            actual = actual.expression;
        } else if (ts.isIdentifier(actual)) {
            let simbolo = typeChecker.getSymbolAtLocation(actual);
            if (simbolo && (simbolo.flags & ts.SymbolFlags.Alias)) {
                simbolo = typeChecker.getAliasedSymbol(simbolo);
            }
            const declaracion = simbolo?.valueDeclaration;
            if (declaracion !== undefined && ts.isVariableDeclaration(declaracion) && declaracion.initializer !== undefined && (ts.getCombinedNodeFlags(declaracion) & ts.NodeFlags.Const) !== 0) {
                actual = declaracion.initializer;
            } else {
                return actual;
            }
        } else {
            return actual;
        }
    }

    return actual;
}
