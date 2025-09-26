import {spawn as processSpawn} from "node:child_process";

export type SpawnResult = {
    status: number;
    stdout: string;
    stderr: string;
}

export const spawn = async (command: string, params: string[]): Promise<SpawnResult> => {
    return new Promise((resolve) => {
        const process = processSpawn(command, params, {
            stdio: "pipe",
        });

        const stdout: string[] = [];
        process.stdout.on("data", (data)=>{
            stdout.push(data.toString("utf-8"));
        });
        const stderr: string[] = [];
        process.stderr.on("data", (data)=>{
            stderr.push(data.toString("utf-8"));
        });

        process.on("close", (status)=>{
            resolve({
                status: status??0,
                stdout: stdout.join(""),
                stderr: stderr.join(""),
            })
        });
    })
}
