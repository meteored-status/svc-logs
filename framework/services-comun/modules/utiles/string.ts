const comments: RegExp = /<!--[\s\S]*?-->/gi;
const tags: RegExp = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

const DECODED_ENTITIES: string[] = [
    '&amp;',
    '&lt;',
    '&gt;',
    '&quot;',
    '&aacute;',
    '&eacute;',
    '&iacute;',
    '&oacute;',
    '&uacute;',
    '&ntilde;',
    '&Aacute;',
    '&Eacute;',
    '&Iacute;',
    '&Oacute;',
    '&Uacute;',
    '&Ntilde;',
    '&#039;'
];
const ENCODED_ENTITIES: string[] = [
    '&',
    '<',
    '>',
    '"',
    'á',
    'é',
    'í',
    'ó',
    'ú',
    'ñ',
    'Á',
    'É',
    'Í',
    'Ó',
    'Ú',
    'Ñ',
    "'" // This is not an entity, but it's used in the same way
];
const URL_INVALID: string[] = [
    '&#40;',
    '&#41;',
    '&#45;',
    '(',
    ')',
    '&#46;',
    '&#49;',
    '&iexcl;',
    '&iquest;',
    '&laquo;',
    '&raquo;',
    '&quot;',
    '&amp;',
    'lt&;',
    'gt&;',
    '&#039;',
    '´',
    "'",
    ',',
    '!',
    '.',
    '&rsquo;',
    '&#47;',
    '/'
];

export const strip_tags = (text: string, allowed: string = '') => {
    allowed = (allowed.toLowerCase().match(/<[a-z][a-z0-9]*>/g)||[]).join('');
    return text.replace(comments, '').replace(tags, (str:string, tag:string) => {
        return allowed.indexOf(`<${tag.toLowerCase()}>`) >= 0 ? str : '';
    });
}

export const fromEntities = (text: string) => {
    return text.replace(new RegExp(`(${DECODED_ENTITIES.join('|')})`, 'g'), (entity:string) => {
        const pos: number = DECODED_ENTITIES.indexOf(entity);
        if (pos >= 0) return ENCODED_ENTITIES[pos];
        return '';
    });
};

export const toEntities = (text: string) => {
    return text.replace(new RegExp(`(${ENCODED_ENTITIES.join('|')})`, 'g'), (entity:string) => {
        const pos: number = ENCODED_ENTITIES.indexOf(entity);
        if (pos >= 0) return DECODED_ENTITIES[pos];
        return '';
    });
};

export const removeAccents = (text: string) => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
};

export const str_word_count = (text: string, additionals: string = '') => {
    const words: string[] = [];

    const len: number = text.length;
    const regAdtl: RegExp = new RegExp(`[${additionals}]`, 'i');

    let wordCandidate: string = '';

    for (let i = 0; i < len; i++) {
        const c: string = text.charAt(i);
        const validChar: boolean = (/[A-Za-z]/.test(c) || regAdtl.test(c) || ((i !== 0 && i !== len - 1) && c === '-') || (i !== 0 && c === "'"));

        if (validChar) {
            wordCandidate += c;
        }
        if (i === len - 1 || !validChar && wordCandidate !== '') {
            words.push(wordCandidate);
            wordCandidate = '';
        }
    }
    return words.length;
};

export const toUrl = (text: string) => {
    return encodeURI(
            toEntities(
                fromEntities(text)
            )
            .replace(new RegExp(`(${URL_INVALID.join('|')})`, 'g'), '')
            .replace('-', ' ')
        )
        .replace('%E2%80%8B', '')
    ;
};
