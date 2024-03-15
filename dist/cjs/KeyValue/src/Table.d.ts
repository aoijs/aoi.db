/// <reference types="node" />
import EventEmitter from "node:events";
import { KeyValueTableOptions, LogBlock } from "../typings/interface.js";
import KeyValue from "./database.js";
import FileManager from "./FileManager.js";
import { KeyValueDataValueType, KeyValueTypeList } from "../typings/type.js";
import Data from "./data.js";
export default class Table extends EventEmitter {
    #private;
    locked: boolean;
    isFlushing: boolean;
    paths: {
        log: string;
        table: string;
    };
    logData: {
        fd: number;
        size: number;
        fileSize: number;
        logIV: string;
    };
    readyAt: number;
    constructor(options: KeyValueTableOptions, db: KeyValue);
    get options(): KeyValueTableOptions;
    get db(): KeyValue;
    get fileManager(): FileManager;
    initialize(): Promise<void>;
    getLogs(): Promise<LogBlock[]>;
    set(key: string, value: KeyValueDataValueType, type?: KeyValueTypeList): Promise<void>;
    get(key: string): Promise<Data | undefined>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
    all(query: (d: Data) => boolean, limit: number, order: "firstN" | "asc" | "desc"): Promise<Data[]>;
    findOne(query: (d: Data) => boolean): Promise<Data | undefined>;
    findMany(query: (d: Data) => boolean): Promise<Data[]>;
    removeMany(query: (d: Data) => boolean): Promise<void>;
    ping(): Promise<number>;
}
//# sourceMappingURL=Table.d.ts.map