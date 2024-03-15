import { KeyValueData } from "../index.js";
import Table from "./Table.js";
export default class FileManager {
    #private;
    constructor(maxSize: number, hashSize: number | undefined, table: Table);
    initialize(): void;
    get maxHashArraySize(): number;
    get hashSize(): number;
    add(data: KeyValueData): void;
    remove(data: KeyValueData["key"]): void;
    get(key: KeyValueData["key"]): Promise<KeyValueData | undefined>;
    clear(): void;
    has(key: KeyValueData["key"]): Promise<boolean>;
    all(query: (d: KeyValueData) => boolean, limit: number, order: "firstN" | "asc" | "desc"): Promise<KeyValueData[] | Set<KeyValueData>>;
    findOne(query: (d: KeyValueData) => boolean): Promise<KeyValueData | undefined>;
    findMany(query: (d: KeyValueData) => boolean): Promise<KeyValueData[]>;
    getFirstN(query: (d: KeyValueData) => boolean, limit: number): Promise<KeyValueData[]>;
    removeMany(query: (d: KeyValueData) => boolean): Promise<void>;
    ping(): Promise<number>;
}
//# sourceMappingURL=FileManager.d.ts.map