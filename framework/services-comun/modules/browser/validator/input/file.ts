import {InputValidator} from ".";
import type {IOptions} from "../index";

interface IFileOptions extends IOptions {
    maxSize?: number;
}

type IPartialFileOptions = Partial<IFileOptions>;

export class FileValidator extends InputValidator {
    /* STATIC */
    public static override buildID(id: string, options: IPartialFileOptions = {}): InputValidator {
        return new this(document.getElementById(id) as HTMLInputElement|null, options);
    }

    /* INSTANCE */
    public readonly maxSize?: number;

    public constructor(element: HTMLInputElement|null, options?: IPartialFileOptions) {
        super(element, options);

        this.maxSize = options?.maxSize;
    }

    public override async validate(): Promise<boolean> {
        if (this.element==null) {
            return !this.options.required;
        }
        const file = this.element.files?.[0];
        if (file==null) {
            return false;
        }
        if (this.maxSize!=undefined && file.size>this.maxSize) {
            return false;
        }
        return file.name.toLowerCase().endsWith(".pdf");
    }
}
