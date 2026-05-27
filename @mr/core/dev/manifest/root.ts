/**
 * Clase base abstracta para todos los nodos del árbol de manifiesto.
 *
 * Proporciona el contrato mínimo que deben cumplir todos los modelos del
 * manifiesto: ser construibles desde un POJO y serializables de vuelta a él
 * mediante {@link toJSON}. La serialización se usa para persistir el manifiesto
 * en disco (`mrpack.json`) y para comparar versiones.
 *
 * @template T - Interfaz POJO que representa el nodo en su forma serializada.
 */
export abstract class ManifestRoot<T> {
    /* INSTANCE */
    protected constructor() {
        // silencio de warning
    }

    public abstract toJSON(): T;
}
