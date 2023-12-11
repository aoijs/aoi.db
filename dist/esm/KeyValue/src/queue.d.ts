import { KeyValueData } from "../index.js";
interface setQueue {
    data: KeyValueData[];
    size: number;
    [key: string]: number;
}
interface DeleteQueue {
    data: {
        key: string;
        file: string;
    }[];
    size: number;
}
export default class QueueManager {
    #private;
    add(data: KeyValueData | {
        key: string;
        file: string;
    }): void;
    clear(type: "set" | "delete"): void;
    get<T extends "set" | "delete">(type: T): T extends "set" ? setQueue : DeleteQueue;
    has(type: "set" | "delete", key: string): boolean;
    remove(type: "set" | "delete", key: string): void;
    getQueueSize(type: "set" | "delete"): number;
}
export {};
//# sourceMappingURL=queue.d.ts.map