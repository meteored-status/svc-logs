export abstract class CustomError extends Error {
    protected constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = "CustomError"; // en subclases, es importante hacer esto
    }
}
