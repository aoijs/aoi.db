/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "events";
import { KeyValue, KeyValueDataInterface, KeyValueJSONOption, KeyValueTableOptions, LogBlock } from "../index.js";
import Cacher from "./newcache.js";
import { WriteStream } from "fs";
import Data from "./data.js";
import HashManager from "./FileManager.js";
export default class Table extends EventEmitter {
    #private;
    locked: boolean;
    isFlushing: boolean;
    repairMode: boolean;
    files: {
        name: string;
        size: number;
        isInWriteMode: boolean;
    }[];
    paths: {
        reference: string;
        log: string;
        table: string;
        fullWriter: string;
    };
    logData: {
        writer: WriteStream;
        size: number;
        fullWriter: WriteStream;
        logIV: string;
    };
    readyAt: number;
    hashManager: HashManager;
    referencer: any;
    constructor(options: KeyValueTableOptions, db: KeyValue);
    get options(): KeyValueTableOptions;
    get db(): KeyValue;
    initialize(): Promise<void>;
    fetchFile(path: string): Promise<Record<string, KeyValueJSONOption> | undefined>;
    getLogs(): Promise<LogBlock[]>;
    set(key: string, dataObj: Partial<KeyValueDataInterface>): Promise<void>;
    get(key: string): Promise<Data | null>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    all(query: (d: Data) => boolean, limit: number, order: "firstN" | "asc" | "desc"): Promise<Data[]>;
    findOne(query: (d: Data) => boolean): Promise<Data | null>;
    findMany(query: (d: Data) => boolean): Promise<Data[]>;
    getFirstN(query: (d: Data) => boolean, limit: number): Promise<Data[]>;
    deleteMany(query: (d: Data) => boolean): Promise<void>;
    add(key: string, value: Partial<KeyValueDataInterface>): Promise<void>;
    subtract(key: string, value: Partial<KeyValueDataInterface>): Promise<void>;
    ping(): Promise<number>;
    fullRepair(): Promise<void>;
    get cache(): Cacher<string, Data>;
}
//# sourceMappingURL=newtable.d.ts.map