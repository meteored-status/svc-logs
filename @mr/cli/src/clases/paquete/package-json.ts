/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 08:26:05 GMT
 * Hash: def87ab3f45c89d2ae195ff9d3bb64fd
 * Versión: 2026.11.9+6-bixus
 * Anterior: 2026.11.9+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * `true` si es un objeto JSON (no un array ni `null`).
 *
 * @param valor - Valor JSON.
 * @returns Si se puede recorrer por claves.
 */
function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return typeof valor==="object" && valor!==null && !Array.isArray(valor);
}

/**
 * Devuelve `valor` con las claves en el orden de `plantilla`, a todos los niveles. Las que solo están
 * en `valor` van detrás, en su orden; y si el objeto tiene `default`, esa va la última, porque en las
 * condiciones de `exports` el orden decide y `default` solo vale al final.
 *
 * @param valor - Objeto con las claves en cualquier orden.
 * @param plantilla - Objeto con el orden bueno (el del `package.json` remoto).
 * @returns Una copia reordenada.
 */
function ordenarComo(valor: unknown, plantilla: unknown): unknown {
    if (Array.isArray(valor)) {
        return valor.map((item, i) => ordenarComo(item, Array.isArray(plantilla) ? plantilla[i] : undefined));
    }
    if (!esObjeto(valor)) {
        return valor;
    }
    const modelo = esObjeto(plantilla) ? plantilla : {};
    const claves = [...Object.keys(modelo).filter((k) => k in valor), ...Object.keys(valor).filter((k) => !(k in modelo))];
    if (claves.includes("default")) {
        claves.splice(claves.indexOf("default"), 1);
        claves.push("default");
    }
    const resultado: Record<string, unknown> = {};
    for (const clave of claves) {
        resultado[clave] = ordenarComo(valor[clave], modelo[clave]);
    }

    return resultado;
}

/**
 * El `package.json` raíz de un framework tal como tiene que quedar después de aplicar una versión
 * nueva.
 *
 * Para entonces el update ya lo ha mezclado a tres bandas como cualquier otro fichero, así que
 * `local` lleva los cambios de la versión nueva **y** los que hubiera en local sin enviar (un
 * script, una dependencia…). Antes se sobrescribía sin más con el remoto, y esos cambios locales se
 * perdían sin aviso. Ahora se conserva la mezcla y se le fija la `version` de la nueva, que es lo
 * único que tiene que coincidir sí o sí con el remoto.
 *
 * **Y se le devuelve el orden de claves del remoto.** Para mezclar, el update ordena alfabéticamente
 * todas las claves del JSON (`normalizarJSON()` en `file.ts`), y en `exports` el orden importa: con
 * `default` delante de `node`, la condición `node` no se usa nunca. Mientras el resultado se tiraba
 * no se notaba.
 *
 * Si la mezcla no es un JSON válido —tiene marcas de conflicto— o no existe, se queda el remoto, como
 * antes: un `package.json` roto deja sin Yarn a todo el monorepo. El conflicto ya consta en el log
 * del update.
 *
 * @param local - Contenido en disco tras la mezcla, o `undefined` si no hay fichero.
 * @param remoto - `package.json` de la versión nueva.
 * @returns El contenido que hay que escribir.
 */
export function packageJsonTrasUpdate(local: string|undefined, remoto: string): string {
    if (local===undefined) {
        return remoto;
    }
    let mezcla: unknown;
    try {
        mezcla = JSON.parse(local);
    } catch {
        return remoto;
    }
    if (!esObjeto(mezcla)) {
        return remoto;
    }
    const plantilla = JSON.parse(remoto) as unknown;
    const resultado = ordenarComo(mezcla, plantilla) as Record<string, unknown>;
    const version = esObjeto(plantilla) ? plantilla["version"] : undefined;
    if (version===undefined) {
        delete resultado["version"];
    } else {
        resultado["version"] = version;
    }

    return `${JSON.stringify(resultado, null, 2)}\n`;
}
