const letras = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function random(chars:number=8):string {
    let salida = '';
    for(let i=0;i<chars;i++) {
        salida += letras.charAt(Math.round(Math.random()*62));
    }

    return salida;
}

function valoresValidos(listado:number[]):number[] {
    if (listado.length<3) {
        return [];
    }
    const minimo = listado.reduce((minimo:number, actual:number)=>{
        return actual<minimo?actual:minimo;
    });
    const maximo = listado.reduce((maximo:number, actual:number)=>{
        return actual>maximo?actual:maximo;
    });
    if (Math.abs(minimo-maximo)<1) {
        return listado;
    }
    const menores:number[] = [];
    const mayores:number[] = [];
    let medianos:boolean = false;
    for (let actual of listado) {
        const diferencia_menor = Math.abs(actual-minimo);
        const diferencia_mayor = Math.abs(actual-maximo);
        if (diferencia_menor<diferencia_mayor) {
            menores.push(actual);
        } else if (diferencia_menor>diferencia_mayor) {
            mayores.push(actual);
        } else {
            medianos = true;
            menores.push(actual);
            mayores.push(actual);
        }
    }
    if (medianos) {
        return listado;
    }
    if (menores.length==1) {
        listado.splice(listado.indexOf(menores[0]), 1);
    }
    if (mayores.length==1) {
        listado.splice(listado.indexOf(mayores[0]), 1);
    }

    return listado;
}

export {random, valoresValidos};
