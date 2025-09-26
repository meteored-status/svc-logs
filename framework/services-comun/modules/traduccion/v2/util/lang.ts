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
