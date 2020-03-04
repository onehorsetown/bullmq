/// <reference types="node" />
import { ChildProcess } from 'child_process';
export interface ChildProcessExt extends ChildProcess {
    processFile?: string;
}
export declare class ChildPool {
    retained: {
        [key: number]: ChildProcessExt;
    };
    free: {
        [key: string]: ChildProcessExt[];
    };
    constructor();
    retain(processFile: string): Promise<ChildProcessExt>;
    release(child: ChildProcessExt): void;
    remove(child: ChildProcessExt): void;
    kill(child: ChildProcess, signal?: string): void;
    clean(): void;
    getFree(id: string): ChildProcessExt[];
    getAllFree(): ChildProcessExt[];
}
export declare const pool: ChildPool;
