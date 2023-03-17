import { KeyValueDataOption, KeyValueJSONOption, KeyValueSetDataOption } from "../typings/interface.js";
import { Cacher } from "./cacher.js";
import { Data } from "./data.js";
import { KeyValue } from "./database.js";
import { KeyValueQueue as Queue } from "./queueManager.js";
export declare class Table {
    #private;
    name: string;
    path: string;
    db: KeyValue;
    queue: Queue;
    files: string[];
    references: Map<string, string> | string;
    cache: Cacher;
    routers: Record<string, number>;
    ready: boolean;
    readyTimestamp: number;
    constructor(name: string, path: string, db: KeyValue);
    _getFiles(): string[];
    set(key: string, value: KeyValueSetDataOption): Promise<void>;
    _update(): Promise<void>;
    _currentFile(): string;
    connect(): void;
    _createNewFile(): void;
    setReference(key: string, file: string): void;
    _getReferenceDataFromFile(): Record<string, string> | undefined;
    _createReferencePath(): void;
    get(key: string): Promise<Data | undefined>;
    _get(key: string, file: string): Promise<KeyValueJSONOption | undefined>;
    all(filter?: (key?: string) => boolean, limit?: number, sortType?: "asc" | "desc"): Promise<Data[]>;
    delete(key: string): Promise<void>;
    _deleteUpdate(): Promise<void>;
    deleteReference(key: string): void;
    clear(): void;
    getPing(): number;
    getDataFromFile(fileNumber: number): Promise<Record<string, KeyValueJSONOption> | undefined>;
    setMultiple(...data: {
        key: string;
        options: KeyValueDataOption;
    }[]): Promise<void>;
    getReferenceSize(): Promise<number>;
}
//# sourceMappingURL=table.d.ts.map