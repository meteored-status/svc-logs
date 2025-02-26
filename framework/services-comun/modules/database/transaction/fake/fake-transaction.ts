import {Transaction} from "../transaction";

export class FakeTransaction extends Transaction {
    /* STATIC */

    /* INSTANCE */
    public constructor() {
        super();
    }

    public override async begin(): Promise<void> {
        return Promise.resolve();
    }

    public override async commit(): Promise<void> {
        return Promise.resolve();
    }

    public override async rollback(): Promise<void> {
        return Promise.resolve();
    }
}