
//Funcion para parsear el idioma cuando venga en formato largo con numeros
export function parseIdioma(idioma: string) {
    if(idioma.match(/[a-z]{2}_[0-9]+$/) || idioma.match(/[a-z]{2}-[0-9]+$/)){
        return idioma.substring(0, 2);
    } else return idioma;
}
