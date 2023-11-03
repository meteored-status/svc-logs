import * as fs from "node:fs";

import {readFile} from "../utiles/fs";

export interface IFile {
    buffer: Promise<Buffer>;
    stream: NodeJS.ReadableStream;
}

export class File implements IFile {
    /* INSTANCE */
    public get buffer(): Promise<Buffer> {
        return readFile(this.file);
    }

    public get stream(): NodeJS.ReadableStream {
        return fs.createReadStream(this.file);
    }

    public constructor(private readonly file: string) {
    }
}
