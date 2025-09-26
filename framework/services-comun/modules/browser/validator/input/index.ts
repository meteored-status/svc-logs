import {type IPartialOptions, Validator} from "..";

export class InputValidator extends Validator<HTMLInputElement> {
    /* STATIC */
    public static buildID(id: string, options: IPartialOptions = {}): InputValidator {
        return new this(document.getElementById(id) as HTMLInputElement|null, options);
    }

    /* INSTANCE */
    public constructor(element: HTMLInputElement|null, options?: IPartialOptions) {
        super(element, options);
    }

    public async validate(): Promise<boolean> {
        if (this.element==null) {
            return !this.options.required;
        }
        return this.element.value.length>0;
    }

}
