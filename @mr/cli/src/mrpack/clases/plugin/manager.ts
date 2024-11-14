import {PluginTemplate} from "./template";

export class PluginManager<T> {
    private plugins: PluginTemplate<T>[];

    public constructor() {
        this.plugins = [];
    }

    public async load(plugin: PluginTemplate<T>) {
        this.plugins.push(plugin);
        await plugin.start();
    }

    public async unload(pluginName: string) {
        const plugin = this.plugins.find(plugin => plugin.name == pluginName);
        if (plugin==undefined) {
            return false;
        }

        await plugin.stop();
        return true;
    }
}
