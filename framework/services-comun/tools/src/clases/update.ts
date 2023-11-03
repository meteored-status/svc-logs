import {Framework} from "./framework";
import {Init} from "./init";
import {Yarn} from "./yarn";

export class Update {
    /* STATIC */
    public static async init(basedir: string): Promise<void> {
        await Init.init(basedir);
        await Framework.update(basedir);
        await Yarn.update(basedir);
    }

    /* INSTANCE */
}
