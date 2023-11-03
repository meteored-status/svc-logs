import {cpus, loadavg} from "os";
import pidusage from "pidusage";

export class Cpu implements Disposable {
    /* STATIC */
    private static CPUs = Math.max(1, cpus().length);

    /* INSTANCE */
    private started: boolean;
    private cpu_window: number[];

    public cpu: number;
    public memory: number;
    public get load(): number { return loadavg()[0]/Cpu.CPUs; }

    public constructor() {
        this.started = false;
        this.cpu_window = [];

        this.cpu = 0;
        this.memory = 0;

        this.startTimer();
    }

    private run(): void {
        pidusage(process.pid)
            .then((stats)=>{
                this.cpu_window.push(stats.cpu/Cpu.CPUs);
                this.cpu_window = this.cpu_window.slice(-10);
                this.cpu = this.cpu_window.reduce((a, b)=>a+b, 0)/this.cpu_window.length;

                this.memory = stats.memory;
            })
            .catch(()=>{})
            .finally(()=>{
                this.interval();
            });
    }

    private interval(): void {
        if (!this.started) {
            return;
        }

        setTimeout(()=>{
            this.run();
        }, 1000);
    }

    public startTimer(): void {
        if (this.started) {
            return;
        }

        this.started = true;
        this.run();
    }

    public stopTimer(): void {
        // if (!this.started) {
        //     return;
        // }

        this.started = false;
    }

    public [Symbol.dispose](): void {
        this.stopTimer();
    }
}

const CPU = new Cpu();
export default CPU;
