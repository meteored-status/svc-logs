import {info} from "../log";
import {spawn} from "./process";
import {Pod} from "./pod";

interface IConfig {
    context?: string;
    namespace?: string;
}


export class Kubectl {
    /* STATIC */
    public static async init(config: IConfig = {}): Promise<Kubectl> {
        const instance = new Kubectl(config);
        return instance.setContext();
    }

    /* INSTANCE */
    private constructor(private readonly _config: IConfig) {
    }

    private get config(): IConfig {
        return this._config;
    }

    private get context(): string|undefined {
        return this.config.context;
    }

    private get namespace(): string|undefined {
        return this.config.namespace;
    }

    public async setContext(context?: string): Promise<Kubectl> {
        if (!context && !this.context) {
            throw new Error(`Context not provided`);
        }

        const result = await spawn('kubectl', ['config', 'use-context', context||this.context||'']);

        if (result.status != 0) {
            throw new Error(result.stderr);
        }

        info(`Context set to ${context||this.context||''}`);

        return this;
    }

    public async getPods(namespace?: string): Promise<Pod[]> {
        const result = await spawn('kubectl', ['get', 'pods', `-n${namespace??this.namespace}`]);

        if (result.status != 0) {
            throw new Error(result.stderr);
        }

        const pods: Pod[] = [];

        const lines = result.stdout.split('\n');

        lines.forEach(line => {
            const match = line.match(/^(['a-z\d\-]+)\s+\d+\/\d+\s+([a-zA-Z]+).+$/);

            if (match) {
                const name = match[1];
                const status = match[2];

                pods.push(new Pod({
                    name,
                    status,
                }));
            }
        });

        return pods;
    }

    public async exec(pod: Pod, command: string[]): Promise<string> {
        const result = await spawn('kubectl', ['exec', `-n${this.namespace}`, pod.name, '--', ...command]);

        if (result.status != 0) {
            throw new Error(result.stderr);
        }

        return result.stdout||result.stderr;
    }
}
