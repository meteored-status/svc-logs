import {ReceiverIdentifier} from "../receiver-identifier";
import {SparkpostSend} from "../../data/model/sparkpost-send";

export class SparkpostReceiverIdentifier extends ReceiverIdentifier {
    /* STATIC */

    /* INSTANCE */
    public constructor(send: SparkpostSend) {
        super(send);
    }

    protected override get send(): SparkpostSend {
        return super.send as SparkpostSend;
    }

    public override identify(): string[] {
        if (!this.send.email) {
            throw new Error('Invalid send email');
        }
        return this.send.email.to.map(to => to.email);
    }
}
