/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 20 Oct 2026 13:12:58 GMT
 * Hash: fe28b89f8d13d998eaa552b659b89a06
 * Versión: 2026.10.20+4-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-api.git
 */

/**
 * Opciones de {@link CacheTtl}.
 *
 * @property ahora - Reloj, en epoch ms. Por defecto `Date.now`; se inyecta en las pruebas para controlar la caducidad.
 */
export interface ICacheTtlConfig {
    ahora?: ()=>number;
}

/**
 * Carga en curso de una clave. `token` identifica esa carga concreta: si la entrada se invalida mientras carga, el token que hay en el mapa
 * deja de ser el suyo y su resultado no se guarda.
 *
 * @property token - Identidad de la carga.
 * @property promesa - La carga, que comparten todos los que piden la clave mientras dura.
 */
interface IEnCurso<V> {
    token: object;
    promesa: Promise<V>;
}

/**
 * Caché **en memoria, por proceso**, con caducidad y *single-flight*: si varias peticiones piden a la vez una clave que no está (o ha
 * caducado), se lanza **una sola** carga y todas esperan a la misma promesa.
 *
 * No es la caché de `modules/cache/` ni la de `net/cache/`: esas guardan respuestas HTTP o usan adaptadores de disco/Valkey. Esta solo
 * memoiza el resultado de una función asíncrona durante unos segundos; no se comparte entre procesos ni sobrevive a un reinicio.
 *
 * Los fallos no se guardan: si la carga rechaza (o `cargar` lanza de forma síncrona), rechazan todos los que la esperaban y la siguiente
 * petición vuelve a intentarlo.
 *
 * Cada vez que termina una carga se barren las entradas caducadas, para que las claves que ya nadie pide no se acumulen.
 */
export class CacheTtl<K, V> {
    /* INSTANCE */

    private readonly ttlMs: number;
    private readonly cargar: (clave: K)=>Promise<V>;
    private readonly ahora: ()=>number;
    private readonly entradas: Map<K, {valor: V; caduca: number}>;
    private readonly enCurso: Map<K, IEnCurso<V>>;

    /**
     * @param ttlMs - Cuánto vale una entrada tras cargarse.
     * @param cargar - Obtiene el valor de una clave que no está (o ha caducado).
     */
    public constructor(ttlMs: number, cargar: (clave: K)=>Promise<V>, {ahora = Date.now}: ICacheTtlConfig = {}) {
        this.ttlMs = ttlMs;
        this.cargar = cargar;
        this.ahora = ahora;
        this.entradas = new Map<K, {valor: V; caduca: number}>();
        this.enCurso = new Map<K, IEnCurso<V>>();
    }

    /**
     * Valor de `clave`. Si no está o ha caducado, lo carga con `cargar` —salvo que ya haya una carga en curso para esa clave, en cuyo caso
     * se espera a esa y `cargar` no se vuelve a llamar—.
     */
    public async get(clave: K): Promise<V> {
        const guardada = this.entradas.get(clave);
        if (guardada !== undefined) {
            if (guardada.caduca > this.ahora()) {
                return guardada.valor;
            }
            this.entradas.delete(clave);
        }

        let carga = this.enCurso.get(clave);
        if (carga === undefined) {
            const token = {};
            carga = {token, promesa: this.lanzar(clave, token)};
            this.enCurso.set(clave, carga);
        }

        return await carga.promesa;
    }

    /**
     * Invalida la entrada de `clave`: la siguiente petición vuelve a cargarla. Si hay una carga en curso, se deja terminar —quienes ya la
     * esperaban reciben su resultado— pero **no se guarda**, y la siguiente petición lanza una carga nueva.
     */
    public delete(clave: K): void {
        this.entradas.delete(clave);
        this.enCurso.delete(clave);
    }

    /**
     * Invalida todas las entradas, con la misma regla que {@link CacheTtl.delete} para las cargas en curso.
     */
    public clear(): void {
        this.entradas.clear();
        this.enCurso.clear();
    }

    private async lanzar(clave: K, token: object): Promise<V> {
        try {
            // Cede un turno antes de llamar a `cargar`: así `get` ya ha registrado la carga cuando `cargar` lanza de forma síncrona o
            // resuelve al instante, y el `finally` no se adelanta a ese registro (dejaría la carga fallida enganchada para siempre)
            await Promise.resolve();
            const valor = await this.cargar(clave);
            if (this.enCurso.get(clave)?.token === token) {
                this.barrer();
                this.entradas.set(clave, {valor, caduca: this.ahora() + this.ttlMs});
            }

            return valor;
        } finally {
            if (this.enCurso.get(clave)?.token === token) {
                this.enCurso.delete(clave);
            }
        }
    }

    /**
     * Quita las entradas caducadas.
     */
    private barrer(): void {
        const ahora = this.ahora();
        for (const [clave, entrada] of this.entradas) {
            if (entrada.caduca <= ahora) {
                this.entradas.delete(clave);
            }
        }
    }
}
