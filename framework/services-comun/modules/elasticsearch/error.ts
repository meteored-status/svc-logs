import {CustomError} from "../utiles/error";

export class ElasticError extends CustomError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = "ElasticError"; // en subclases, es importante hacer esto
    }
}
