import {pipeline, Readable} from "node:stream";
import {promisify} from "node:util";

const pipelinePromise = promisify(pipeline);
export {pipelinePromise as pipeline};

export function buffer2stream(binary: Buffer): Readable {
    return new Readable({
        read() {
            this.push(binary);
            this.push(null);
        },
    });
}

export async function stream2buffer(data: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve)=>{
        const chunks: Buffer[] = [];
        data.on("data", (chunk: Buffer)=>{
            chunks.push(chunk);
        }).on("end", ()=>{
            resolve(Buffer.concat(chunks));
        });
    });
}
