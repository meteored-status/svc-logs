/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: 301ac9459eb727e181612ceae25cd3d4
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

export const pascalCase = (str: string, regex: RegExp = /[^a-zA-Z\d]/) => {
    const words = str.split(regex);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}
