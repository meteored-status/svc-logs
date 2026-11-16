/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:36:06 GMT
 * Hash: 2b57ddca9c30db58a2d82c02a9b17384
 * Versión: 2026.11.11+3-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import ts from "typescript";

/**
 * Texto, ya normalizado, del bloque de autoría que `mrpack framework --send` estampa al principio de cada fichero
 * (ver `paquete/autoria.ts`). TypeScript lo toma como JSDoc de la primera declaración del fichero cuando esta no
 * tiene uno propio; no es documentación del tipo y cambia en cada envío, así que se descarta.
 */
const PATRON_AUTORIA = /^Editor: .* Fecha: /;

/**
 * Lee la documentación JSDoc de los tipos y de sus propiedades para el `description` de los esquemas.
 *
 * Las propiedades de una interfaz se documentan en el bloque del propio tipo (`@property nombre - texto`,
 * convención del monorepo); si no están ahí, vale el JSDoc de la propia propiedad.
 */
export class LectorJSDoc {
    private readonly typeChecker: ts.TypeChecker;
    private readonly propiedadesPorContenedor: Map<ts.Node, Map<string, string>>;

    public constructor(typeChecker: ts.TypeChecker) {
        this.typeChecker = typeChecker;
        this.propiedadesPorContenedor = new Map();
    }

    /**
     * Comentario principal de un tipo (sin las etiquetas), con los saltos de línea colapsados. La cabecera de
     * autoría del fichero no cuenta como comentario del tipo.
     *
     * @param simbolo - Símbolo de la interfaz, alias o enum.
     */
    public descripcionDeTipo(simbolo: ts.Symbol): string | undefined {
        const texto = normalizar(ts.displayPartsToString(simbolo.getDocumentationComment(this.typeChecker)));

        return texto !== undefined && PATRON_AUTORIA.test(texto) ? undefined : texto;
    }

    /**
     * Descripción de una propiedad: la de `@property nombre - texto` del tipo que la declara y, si no hay, el
     * comentario de la propia propiedad.
     *
     * @param propiedad - Símbolo de la propiedad.
     */
    public descripcionDePropiedad(propiedad: ts.Symbol): string | undefined {
        const nombre = propiedad.getName();
        for (const declaracion of propiedad.declarations ?? []) {
            const contenedor = contenedorDocumentado(declaracion);
            const texto = contenedor === undefined ? undefined : this.propiedadesDe(contenedor).get(nombre);
            if (texto !== undefined) {
                return texto;
            }
        }

        return normalizar(ts.displayPartsToString(propiedad.getDocumentationComment(this.typeChecker)));
    }

    /**
     * `true` si el tipo o la propiedad llevan `@deprecated`.
     *
     * @param simbolo - Símbolo del tipo o de la propiedad.
     */
    public esDeprecated(simbolo: ts.Symbol): boolean {
        return (simbolo.declarations ?? []).some(d => ts.getJSDocDeprecatedTag(d) !== undefined);
    }

    private propiedadesDe(contenedor: ts.Node): Map<string, string> {
        let propiedades = this.propiedadesPorContenedor.get(contenedor);
        if (propiedades === undefined) {
            propiedades = new Map();
            for (const etiqueta of ts.getJSDocTags(contenedor)) {
                const par = leerPropiedad(etiqueta);
                if (par !== undefined && !propiedades.has(par.nombre)) {
                    propiedades.set(par.nombre, par.texto);
                }
            }
            this.propiedadesPorContenedor.set(contenedor, propiedades);
        }

        return propiedades;
    }
}

/**
 * Nodo cuyo JSDoc documenta las propiedades de una declaración: su interfaz o clase, o el alias que contiene
 * el literal de tipo (`type X = {a: string}`).
 */
function contenedorDocumentado(declaracion: ts.Declaration): ts.Node | undefined {
    const padre = declaracion.parent;
    if (padre === undefined) {
        return undefined;
    }
    if (ts.isTypeLiteralNode(padre) && ts.isTypeAliasDeclaration(padre.parent)) {
        return padre.parent;
    }

    return padre;
}

/**
 * Interpreta una etiqueta `@property`. TypeScript la entiende como `JSDocPropertyTag` (con nombre) o, si no la
 * puede analizar, como etiqueta genérica cuyo texto es `nombre - descripción`.
 */
function leerPropiedad(etiqueta: ts.JSDocTag): {nombre: string; texto: string} | undefined {
    if (etiqueta.tagName.text !== "property" && etiqueta.tagName.text !== "prop") {
        return undefined;
    }

    const comentario = ts.getTextOfJSDocComment(etiqueta.comment) ?? "";
    if (ts.isJSDocPropertyLikeTag(etiqueta)) {
        const nombre = ts.isIdentifier(etiqueta.name) ? etiqueta.name.text : etiqueta.name.getText();
        const texto = normalizar(comentario.replace(/^\s*-\s*/, ""));

        return texto === undefined ? undefined : {nombre, texto};
    }

    const coincidencia = /^(\S+)\s*-\s*([\s\S]*)$/.exec(comentario.trim());
    const texto = coincidencia === null ? undefined : normalizar(coincidencia[2]);

    return coincidencia === null || texto === undefined ? undefined : {nombre: coincidencia[1], texto};
}

/**
 * Colapsa los saltos de línea y espacios repetidos de un comentario y quita el formato `{@link X}`.
 */
function normalizar(texto: string): string | undefined {
    const limpio = texto.replace(/\{@link\s+([^}|\s]+)[^}]*\}/g, "$1").replace(/\s+/g, " ").trim();

    return limpio === "" ? undefined : limpio;
}
