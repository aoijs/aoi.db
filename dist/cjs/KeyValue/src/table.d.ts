/// <reference types="node" />
/// <reference types="node" />
import { WriteStream } from "fs";
import { DatabaseMethod } from "../../typings/enum.js";
import { KeyValueDataInterface, KeyValueTableOptions } from "../typings/interface.js";
import Data from "./data.js";
import KeyValue from "./database.js";
import Referencer from "../../global/referencer.js";
import { EventEmitter } from "events";
import Cacher from "./cache.js";
export default class Table extends EventEmitter {
    #private;
    options: KeyValueTableOptions;
    db: KeyValue;
    paths: {
        reference: string;
        log: string;
    };
    files: {
        name: string;
        size: number;
        isInWriteMode?: boolean;
    }[];
    logHash: string;
    referencer: Referencer;
    readyAt: number;
    logData: {
        writer: WriteStream;
        size: number;
        fullWriter: WriteStream;
    };
    locked: boolean;
    repairMode: boolean;
    /**
     *
     * @description Creates a new table
     *
     * @mermaid
     * graph LR;
     * A[KeyValue] --> B[Table];
     *
     *
     * @param options The options for the table
     * @param db The database instance
     */
    constructor(options: KeyValueTableOptions, db: KeyValue);
    /**
     * @private
     * @description Initializes the table
     */
    initialize(): Promise<void>;
    /**
     * @description Sets the data in the file
     * @param key The key of the data
     * @param value The value of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.set("key", {
     *  value: "value",
     * })
     * ```
     *
     */
    set(key: string, value: Partial<KeyValueDataInterface>): Promise<Data>;
    /**
     * @description get the transaction log
     * @returns The transaction log
     *
     * @example
     * ```js
     * <KeyValueTable>.getLogs()
     * ```
     */
    getLogs(): Promise<{
        key: string;
        value: string | null;
        type: string;
        ttl: number;
        method: DatabaseMethod;
    }[]>;
    /**
     * @description Gets the queue
     * @returns The queue
     * @readonly
     *
     * @example
     * ```js
     * <KeyValueTable>.queue
     * ```
     */
    get queue(): {
        set: Data[];
        delete: Record<string, string[]>;
    };
    /**
     * @description Get the value for the key
     * @param key The key of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.get("key")
     * ```
     */
    get(key: string): Promise<Data | null>;
    /**
     * @description Deletes the data
     * @param key The key of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.delete("key")
     * ```
     */
    delete(key: string): Promise<void | null>;
    /**
     * @private
     * @param key The key of the data
     * @param file The file where the data is stored
     * @returns
     */
    get cache(): Cacher;
    /**
     * @description Clears the table
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.clear()
     * ```
     */
    clear(): Promise<void>;
    /**
     * @description Checks if the key exists
     * @param key The key of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.has("key")
     * ```
     */
    has(key: string): Promise<boolean>;
    /**
     * @description Finds the data
     * @param query The query to find the data
     * @returns The data
     *
     * @example
     * ```js
     * <KeyValueTable>.findOne((v, index) => v.value === "value")
     * ```
     */
    findOne(query: (value: Data, index: number) => boolean): Promise<Data | null>;
    /**
     *
     * @param query The query to find the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.findMany((v, index) => v.value === "value")
     * ```
     */
    findMany(query: (value: Data, index: number) => boolean): Promise<Data[]>;
    /**
     *
     * @param query The query to find the data
     * @param limit  The limit of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.all(() => true, 10) // returns the first 10 data
     * ```
     */
    all(query?: (value: Data, index: number) => boolean, limit?: number): Promise<Data[]>;
    /**
     * @description Executes a full repair on the table
     * @returns
     *
     * @example
     * <KeyValueTable>.fullRepair()
     *
     * @note This method is very slow and should only be used when the table is corrupted
     */
    fullRepair(): Promise<boolean>;
    /**
     * @description Deletes the data
     * @param query The query to find the data
     * @returns The data deleted if query is provided else boolean if whole table is cleared
     * @example
     * ```js
     * <KeyValueTable>.deleteMany((v, index) => v.value === "value")
     * ```
     */
    deleteMany(query?: (value: Data, index: number) => boolean): Promise<true | Data[]>;
    addTableToLog(): Promise<void>;
    ping(): Promise<number>;
}
//# sourceMappingURL=table.d.ts.map