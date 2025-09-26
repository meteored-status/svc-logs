export const pascalCase = (str: string, regex: RegExp = /[^a-zA-Z]/) => {
    const words = str.split(regex);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}
