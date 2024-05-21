/// <reference types="node" />
import Data from "./data.js";
import LRUCache from "./LRUcache.js";
import Table from "./Table.js";
export default class File {
    #private;
    constructor(path: string, capacity: number, table: Table);
    init(): Promise<void>;
    get name(): string;
    get size(): number;
    get path(): string;
    get cache(): LRUCache;
    get isDirty(): boolean;
    get locked(): boolean;
    get flushQueue(): Data[];
    get interval(): NodeJS.Timeout;
    get(key: string): Promise<Data | undefined>;
    put(key: string, value: Data): Promise<void>;
    getAll(query?: (d: Data) => boolean): Promise<Data[]>;
    findOne(query?: (d: Data) => boolean): Promise<Data | undefined>;
    remove(data: Data["key"]): Promise<void>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
    removeMany(query: (d: Data) => boolean): Promise<void>;
    ping(): Promise<number>;
    unlink(): Promise<void>;
    lockAndsync(): Promise<void>;
}
//# sourceMappingURL=File.d.ts.map