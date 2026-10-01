/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 03ff26edd49775cde108e5d4a7b1f788
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

class Cookies {
    public set(key: string, value: string, expires?: Date, domain?: string, path?: string): void {
        const componentes:string[] = [];

        componentes.push(`${key}=${encodeURIComponent(value)}`);
        if (expires!=undefined) {
            componentes.push(`expires=${expires.toUTCString()}`);
        }
        if (domain!=undefined && domain.length>0) {
            componentes.push(`domain=${domain}`);
        }
        componentes.push(`path=${path??"/"}`);
        componentes.push(`secure`);

        document.cookie = componentes.join("; ");
    }

    public get(key: string): string|undefined {
        const cookies = document.cookie.split(";");
        const cantidad = cookies.length;

        for(let i=0;i<cantidad;i++) {
            const actual = cookies[i].trim().split("=");
            if (actual[0]==key) {
                return decodeURIComponent(actual[1]);
            }
        }

        return undefined;
    }

    public remove(key: string, domain?: string, path?: string): void {
        this.set(key, "", new Date(Date.now()-86400000), domain, path);
    }
}

const cookies = new Cookies();

export default cookies;
