/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: f0f39594596e11e840c7021e1ba31e52
 */

export const pascalCase = (str: string, regex: RegExp = /[^a-zA-Z]/) => {
    const words = str.split(regex);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}
