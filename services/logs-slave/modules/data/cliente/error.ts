import {CustomError} from "services-comun/modules/utiles/error";

export class ClienteError extends CustomError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = "ClienteError"; // en subclases, es importante hacer esto
    }
}
