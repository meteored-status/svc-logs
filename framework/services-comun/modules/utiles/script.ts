const ISO_15924_MAP: Record<string, string> = {
    'Latin': 'Latn',
    'Cyrillic': 'Cyrl',
    'Arabic': 'Arab',
    'Greek': 'Grek',
    'Han': 'Hani',
    'Hangul': 'Hang',
    'Hiragana': 'Hira',
    'Katakana': 'Kana',
    'Hebrew': 'Hebr',
    'Devanagari': 'Deva',
    'Bengali': 'Beng',
    'Thai': 'Thai',
    'Armenian': 'Armn',
    'Georgian': 'Geor',
    'Ethiopic': 'Ethi',
    'Khmer': 'Khmr',
    'Myanmar': 'Mymr',
    'Gujarati': 'Gujr',
    'Tamil': 'Taml',
    'Telugu': 'Telu',
    'Malayalam': 'Mlym',
    'Sinhala': 'Sinh',
    'Lao': 'Laoo',
    'Tibetan': 'Tibt',
    'Burmese': 'Mymr',
    'Oriya': 'Orya',
    'Punjabi': 'Guru',
}

export const detect = (text: string): string => {
    const scriptCounts: Record<string, number> = {};

    for (const script of Object.keys(ISO_15924_MAP)) {
        try {
            const regex = new RegExp(`\\p{Script=${script}}`, 'u');
            const matches = text.match(regex);
            if (matches) {
                scriptCounts[ISO_15924_MAP[script]] = matches.length;
            }
        } catch (e) {
            // Ignore unsupported scripts in regex
        }
    }

    let detectedScript = 'Unknown';
    let maxCount = 0;

    for (const [script, count] of Object.entries(scriptCounts)) {
        if (count > maxCount) {
            maxCount = count;
            detectedScript = script;
        }
    }

    return detectedScript;
}
