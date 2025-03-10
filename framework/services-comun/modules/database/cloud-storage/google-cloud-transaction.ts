import {Transaction} from "../transaction/transaction";

export class GoogleCloudTransaction extends Transaction {
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