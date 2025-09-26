import {type IPartialOptions, Validator} from ".";

export class TextAreaValidator extends Validator<HTMLTextAreaElement> {
    /* STATIC */
    public static buildID(id: string, options: IPartialOptions = {}): TextAreaValidator {
        return new this(document.getElementById(id) as HTMLTextAreaElement|null, options);
    }

    /* INSTANCE */
    public constructor(element: HTMLTextAreaElement|null, options?: IPartialOptions) {
        super(element, options);
    }

    public async validate(): Promise<boolean> {
        if (this.element==null) {
            return !this.options.required;
        }
        return this.element.value.length>=20;
    }

}
