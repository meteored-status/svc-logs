
/**
 * MemoryStore basado en Valkey/Redis.
 *
 * Configuración recomendada en Valkey:
 *   maxmemory 1gb
 *   maxmemory-policy allkeys-lru
 *
 * Con `allkeys-lru`, cuando se alcance el límite de 1GB,
 * Valkey eliminará automáticamente las claves menos usadas recientemente (LRU),
 * garantizando que siempre haya espacio para nuevas entradas.
 *
 * El TTL por defecto es de 7 días. Las claves que no se consulten ni actualicen
 * en ese periodo expirarán automáticamente.
 */
export class DefaultValkey {

    /* INSTANCE */
    public constructor() {
    }


    public async get<T>(namespace: string, ids: (string | number)[]): Promise<T | null> {
        return null
    }

    public async set<T>(namespace: string, ids: (string | number)[], data: T, ttl?: number): Promise<void> {

    }

    public async delete(namespace: string, ids: (string | number)[]): Promise<void> {

    }

    public async deletePattern(namespace?: string, ids?: (string | number)[]): Promise<void> {

    }
}

