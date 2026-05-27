/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: c8b911a747b652def6c1985b3bf105ba
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {PluginTemplate} from "./template";

/**
 * Gestor de plugins que permite cargar y descargar instancias de `PluginTemplate` en tiempo de ejecución.
 */
export class PluginManager<T> {
    private plugins: PluginTemplate<T>[];

    public constructor() {
        this.plugins = [];
    }

    /**
     * Registra e inicia un plugin.
     *
     * @param plugin - Instancia del plugin a cargar.
     */
    public async load(plugin: PluginTemplate<T>) {
        this.plugins.push(plugin);
        await plugin.start();
    }

    /**
     * Detiene y elimina un plugin registrado.
     *
     * @param pluginName - Nombre del plugin a descargar.
     * @returns `true` si el plugin fue encontrado y detenido, `false` si no existe.
     */
    public async unload(pluginName: string) {
        const plugin = this.plugins.find(plugin => plugin.name == pluginName);
        if (plugin==undefined) {
            return false;
        }

        await plugin.stop();
        return true;
    }
}
