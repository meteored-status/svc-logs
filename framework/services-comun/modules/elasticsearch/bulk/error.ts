import {CustomError} from "../../utiles/error";

export class BulkError extends CustomError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = "BulkError"; // en subclases, es importante hacer esto
    }
}
