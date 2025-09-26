import {InputValidator} from ".";

class MailValidator extends InputValidator {
    /* STATIC */
    private static MAIL_REGEX:any = /^([\da-z_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/;

    /* INSTANCE */
    public override async validate(): Promise<boolean> {
        return await super.validate() && MailValidator.MAIL_REGEX.test(this.element?.value??"");
    }
}

export {MailValidator};
