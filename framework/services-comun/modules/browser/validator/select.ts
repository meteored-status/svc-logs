import {type IPartialOptions, Validator} from ".";

export class SelectValidator extends Validator<HTMLSelectElement> {
    /* STATIC */
    public static buildID(id: string, options: IPartialOptions = {}): SelectValidator {
        return new this(document.getElementById(id) as HTMLSelectElement|null, options);
    }

    /* INSTANCE */
    public constructor(element: HTMLSelectElement|null, options?: IPartialOptions) {
        super(element, options);
    }

    public async validate(): Promise<boolean> {
        if (this.element==null) {
            return !this.options.required;
        }
        return this.element.value.length>0;
    }
}
