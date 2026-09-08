/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 8aaf28d51aff3e1af0da47137034622d
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export const getLang = (availableLangs: string[], lang: string, defaultLang?: string): string => {
    const normalizedLang = lang.replace(/[-_]/g, "");
    const normalizedDefaultLang = defaultLang?.replace(/[-_]/g, "");

    if (availableLangs.includes(normalizedLang)) {
        return normalizedLang;
    }

    if (normalizedDefaultLang && availableLangs.includes(normalizedDefaultLang)) {
        return normalizedDefaultLang;
    }

    return 'enUS';
};
