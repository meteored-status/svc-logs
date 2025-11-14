import RandExp from "randexp";

export function randomCountryId(regex: RegExp = /^\d|[1-9]\d|[1-2][0-5]\d$/): string {
    return new RandExp(regex).gen();
}

export function randomLang(regex: RegExp = /([a-z]{2}|[a-z]{2}-[A-Z]{2}|[a-z]{2}_[A-Z]{2}|[a-z]{2}_419|[a-z]{2}-419)/): string {
    return new RandExp(regex).gen();
}

export function randomPage(regex: RegExp= /\d/): string {
    return new RandExp(regex).gen();
}

