/// <reference types="node" />
import { KeyValueDataInterface, KeyValueOptions } from "../typings/interface.js";
import { DeepRequired } from "../newsrc/typings/type.js";
import Table from "./Table.js";
import { EventEmitter } from "events";
import Data from "./data.js";
export default class KeyValue extends EventEmitter {
    #private;
    tables: Record<string, {
        table: Table;
        ready: boolean;
    }>;
    readyAt: number;
    /**
     * @description create a new database
     * @param options options to create database
     *
     * @example
     * ```js
     * const db = new KeyValue({
     *  dataConfig:{
     *  path:"./database",
     *  },
     *  encryptionConfig:{
     *  encriptData:true,
     *  securityKey:"a-32-characters-long-string-here"
     *  }
     * })
     * ```
     */
    constructor(options: KeyValueOptions);
    /**
     * @description get default options
     * @static
     * @returns default options
     */
    static defaultOptions(): DeepRequired<KeyValueOptions>;
    /**
     * @description connect to database
     *
     *
     * @example
     * ```js
     * <KeyValue>.connect()
     * ```
     */
    connect(): Promise<void>;
    get options(): DeepRequired<KeyValueOptions>;
    /**
     * @description set data to database
     * @param key key to set
     * @param value value to set
     * @param table table where data will be saved
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.set("main","key",{
     *      value:"value",
     * });
     * ```
     */
    set(table: string, key: string, value: Partial<KeyValueDataInterface>): Promise<void>;
    /**
     * @description get data from database
     * @param table table where data is saved
     * @param key key to get
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.get("main","key");
     * ```
     */
    get(table: string, key: string): Promise<unknown>;
    /**
     * @description delete data from database
     * @param table table where data is saved
     * @param key key to delete
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.delete("main","key");
     * ```
     */
    delete(table: string, key: string): Promise<void>;
    /**
     * @description clear table
     * @param table table to clear
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.clear("main");
     * ```
     */
    clear(table: string): Promise<void>;
    /**
     * @description check if data exists in database
     * @param table table to check
     * @param key key to check
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.has("main","key");
     * ```
     */
    has(table: string, key: string): Promise<unknown>;
    /**
     * @description clear all tables
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.clearAll();
     * ```
     */
    clearAll(): Promise<void>;
    /**
     * @description find the first data that matches the query
     * @param table table to find
     * @param query query to match
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.findOne("main",(value,index)=>{
     *     return value.key === "key" && value.value === "value";
     * })
     * ```
     */
    findOne(table: string, query: (value: Data) => boolean): Promise<Data | undefined>;
    /**
     * @description find all data that matches the query
     * @param table table to find
     * @param query query to match
     * @returns
     *
     * @example
     *  ```js
     * <KeyValue>.findMany("main",(value,index)=>{
     *    return value.key === "key" && value.value === "value";
     * })
     * ```
     */
    findMany(table: string, query: (value: Data) => boolean): Promise<unknown>;
    /**
     * @description get all data from table
     * @param table table to get
     * @param query query to match
     * @param limit limit of data to get
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.all("main",(value,index)=>{
     *   return value.key === "key" && value.value === "value";
     * },10)
     * ```
     */
    all(table: string, query?: (value: Data) => boolean, limit?: number, order?: 'firstN' | 'asc' | 'desc'): Promise<unknown>;
    /**
     * @description perform a backup of database
     * @returns
     *
     * @example
     * ```js
     * setInterval(()=>{
     * <KeyValue>.backup();
     * },1000 * 60 * 60 * 24) // backup every 24 hours
     * ```
     */
    backup(): void;
    /**
     * @description perform a full repair of table
     * @param table table to repair
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.fullRepair("main");
     * ```
     *
     */
    /**
     * @description deletes all data that matches the query
     * @param table table to delete
     * @param query query to match
     * @returns list of deleted data if query is provided else boolean to indicate if table is cleared
     * @example
     * ```js
     * <KeyValue>.deleteMany("main",(value,index)=>{
     *    return value.key === "key" && value.value === "value";
     * })
     * ```
     */
    deleteMany(table: string, query?: (value: Data) => boolean): Promise<unknown>;
    ping(table: string): Promise<unknown>;
    avgPing(): Promise<number>;
}
//# sourceMappingURL=database.d.ts.map