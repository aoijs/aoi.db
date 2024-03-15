import Data from "./data.js";
declare class LRUCache {
    private capacity;
    private cache;
    private queue;
    constructor(capacity: number);
    get(key: string): Data | undefined;
    put(key: string, value: Data): void;
    has(key: string): boolean;
    private updatePriority;
    remove(key: string): void;
    clear(): void;
    all(): Data[];
    findOne(query: (data: Data) => boolean): Data | undefined;
}
export default LRUCache;
//# sourceMappingURL=LRUcache.d.ts.map