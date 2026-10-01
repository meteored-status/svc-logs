/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 2b2c40968989404c2350a122d0a0bb38
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Transaction} from "../transaction";

export class FakeTransaction extends Transaction {
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