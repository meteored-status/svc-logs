import type {TransmissionOptions} from "sparkpost";

export interface IMailManager {
    send: (data: IMail) => Promise<any>;
}

export interface IActor {
    email: string;
    name?: string;
    substitution_data?: any;
}

export interface IAttachment {
    name: string;
    type: string;
    data: string;
}

interface IContent<T=any> {
    type: TContentTypes;
    value: T;
}

abstract class Content<T> implements IContent<T> {
    public type: TContentTypes;
    public value: T;

    protected constructor(type: TContentTypes, value: T) {
        this.type = type;
        this.value = value;
    }
}

export interface ITemplateContent<T> extends IContent<T> {
    name: string;
}

export class TemplateContent<T> extends Content<T> implements ITemplateContent<T> {
    public name: string;

    public constructor(name: string, value: T) {
        super(TContentTypes.TEMPLATE, value);
        this.name = name;
    }
}

interface IInlineContent extends IContent<string>{
}

abstract class InlineContent extends Content<string> implements IInlineContent {
    protected constructor(type: TContentTypes, value: string) {
        super(type, value);
    }
}

export interface IHTMLInlineContent extends IInlineContent {
}

export class HTMLInlineContent extends InlineContent implements IHTMLInlineContent {
    public constructor(value: string) {
        super(TContentTypes.HTML, value);
    }
}

export interface ITextInlineContent extends IInlineContent {
}

export class TextInlineContent extends InlineContent implements ITextInlineContent {
    public constructor(value: string) {
        super(TContentTypes.TEXT, value);
    }
}

export enum TContentTypes {
    HTML        = 1,
    TEXT        = 2,
    TEMPLATE    = 3
}

export interface IMail {
    from?: IActor;
    reply_to?: string;
    to: IActor[];
    subject?: string;
    contents: IContent[];
    delivery?: string;
    attachments?: IAttachment[];
    campaign?: string;
    options?: TransmissionOptions;
}
