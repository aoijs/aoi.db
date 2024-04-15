import { KeyValueData } from "../index.js";
import Table from "./Table.js";
export default class FileManager {
    #private;
    constructor(maxSize: number, hashSize: number | undefined, table: Table);
    initialize(): Promise<void>;
    get maxHashArraySize(): number;
    get hashSize(): number;
    add(data: KeyValueData): Promise<unknown>;
    remove(data: KeyValueData["key"]): Promise<unknown> | undefined;
    get(key: KeyValueData["key"]): Promise<unknown>;
    clear(): Promise<unknown> | undefined;
    has(key: KeyValueData["key"]): Promise<unknown>;
    all(query: (d: KeyValueData) => boolean, limit: number, order: "firstN" | "asc" | "desc"): Promise<unknown>;
    findOne(query: (d: KeyValueData) => boolean): Promise<KeyValueData | undefined>;
    findMany(query: (d: KeyValueData) => boolean): Promise<unknown>;
    getFirstN(query: (d: KeyValueData) => boolean, limit: number): Promise<unknown>;
    removeMany(query: (d: KeyValueData) => boolean): Promise<unknown>;
    ping(): Promise<unknown>;
}
//# sourceMappingURL=FileManager.d.ts.map