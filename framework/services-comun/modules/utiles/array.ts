type TEscalares = string|number|boolean|null;

export function arrayEquals<T extends TEscalares>(array1: T[], array2: T[]): boolean {
    return array1.filter((valor)=>array2.includes(valor)).length == array1.length;
}

export function unique<T extends TEscalares>(array: T[]): T[] {
    return array.filter((item, i, ar)=>ar.indexOf(item)===i);
}

export function arrayChop<T>(array: T[], length: number): T[][] {
    if (length<=0) {
        length = array.length;
    }
    const salida: T[][] = [];
    const total = array.length;
    let inicio = 0;
    while (inicio<total) {
        const fin = inicio+length;
        salida.push(array.slice(inicio, fin));
        inicio = fin;
    }

    return salida;
}
