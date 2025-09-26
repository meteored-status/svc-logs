import {InputValidator} from ".";

export class CheckValidator extends InputValidator {
    /* INSTANCE */
    public override async validate(): Promise<boolean> {
        return (this.element!=null && this.element.checked) || !this.options.required;
    }
}
