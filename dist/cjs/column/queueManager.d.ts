import { WideColumnDataValueType } from "../typings/type.js";
import { WideColumnData } from "./data.js";
export declare class WideColumnQueue {
    queue: {
        get: Map<string, Map<WideColumnDataValueType, WideColumnData | WideColumnDataValueType>>;
        delete: Map<string, Set<WideColumnDataValueType>>;
    };
    queued: {
        get: boolean;
        delete: boolean;
    };
    constructor();
    addToQueue(method: "get" | "delete", path: string, key: WideColumnDataValueType, value?: WideColumnData | WideColumnDataValueType): void;
    deletePathFromQueue(method: "get" | "delete", path: string): boolean;
}
//# sourceMappingURL=queueManager.d.ts.map