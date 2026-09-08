/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 301ac9459eb727e181612ceae25cd3d4
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export const pascalCase = (str: string, regex: RegExp = /[^a-zA-Z\d]/) => {
    const words = str.split(regex);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}
