/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "node:events";
import { KeyValueTableOptions, LogBlock } from "../typings/interface.js";
import KeyValue from "./database.js";
import FileManager from "./FileManager.js";
import fsp from "node:fs/promises";
import { DatabaseMethod } from "../../typings/enum.js";
import { KeyValueDataValueType, KeyValueTypeList } from "../newsrc/typings/type.js";
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
        fd: fsp.FileHandle;
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
    wal(data: Data, method: DatabaseMethod): Promise<void>;
    set(key: string, value: KeyValueDataValueType, type?: KeyValueTypeList): Promise<void>;
    get(key: string): Promise<unknown>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    has(key: string): Promise<unknown>;
    all(query: (d: Data) => boolean, limit: number, order: "firstN" | "asc" | "desc"): Promise<unknown>;
    findOne(query: (d: Data) => boolean): Promise<Data | undefined>;
    findMany(query: (d: Data) => boolean): Promise<unknown>;
    removeMany(query: (d: Data) => boolean): Promise<unknown>;
    ping(): Promise<unknown>;
}
//# sourceMappingURL=Table.d.ts.map