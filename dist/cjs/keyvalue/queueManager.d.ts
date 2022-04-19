import { KeyValueJSONOption } from "../typings/interface.js";
import { Cacher } from "./cacher.js";
import { Data } from "./data.js";
export declare class KeyValueQueue {
    queue: {
        set: Map<string, Map<string, Data>>;
        get: Map<string, Record<string, Data | KeyValueJSONOption>>;
        delete: Map<string, Set<string>>;
        all: Cacher;
        tempref?: Record<string, string>;
    };
    queued: {
        set: boolean;
        get: boolean;
        delete: boolean;
        all: boolean;
    };
    constructor();
    addToQueue(method: "set" | "get" | "delete", path: string, key: string, value?: Data): void;
    deletePathFromQueue(method: "set" | "get" | "delete", path: string): boolean;
}
//# sourceMappingURL=queueManager.d.ts.map