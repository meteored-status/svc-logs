import {Framework} from "./framework";
import {Init} from "./init";
import {Yarn} from "./yarn";

export class Update {
    /* STATIC */
    public static async init(basedir: string): Promise<void> {
        let cambio_init = await Init.init(basedir);
        const cambio_framework = await Framework.update(basedir);
        if (cambio_framework) {
            const cambio = await Init.init(basedir);
            cambio_init = cambio_init || cambio;
        }
        await Yarn.update(basedir, cambio_init || cambio_framework);
    }

    /* INSTANCE */
}
