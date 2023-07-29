import {
    KeyValueDataInterface,
    KeyValueOptions,
} from "../typings/interface.js";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { CacheType,ReferenceType, DatabaseEvents } from "../../typings/enum.js";
import { DeepRequired } from "../typings/type.js";
import { encrypt } from "../../utils.js";
import Table from "./table.js";
import { EventEmitter } from "events";
//zipping and unzipping
import tar from "tar";
import path from "path";
import Data from "./data.js";

export default class KeyValue extends EventEmitter {
    #options: DeepRequired<KeyValueOptions>;
    tables: Record<
        string,
        {
            table: Table;
            ready: boolean;
        }
    > = {};
    readyAt!: number;

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
    constructor(options: KeyValueOptions) {
        super();
        this.#options = this.#finalizeOptions(options);
    }

    /**
     * @description get default options
     * @static
     * @returns default options
     */
    static defaultOptions(): DeepRequired<KeyValueOptions> {
        return {
            dataConfig: {
                path: "./database",
                tables: ["main"],
                referencePath: "./reference/",
            },
            fileConfig: {
                extension: ".sql",
                transactionLogPath: "./transaction/",
                maxSize: 20 * 1024 * 1024,
            },
            encryptionConfig: {
                securityKey: "a-32-characters-long-string-here",
                encriptData: true,
            },
            cacheConfig: {
                cache: CacheType.LRU,
                reference: ReferenceType.Cache,
                limit: 1000,
                sorted: false,
                sortFunction: (a, b) => {
                    return 0;
                },
            },
        };
    }

    /**
     * @private
     * @description finalize options
     * @param options options to finalize
     * @returns
     */

    #finalizeOptions(options: KeyValueOptions): DeepRequired<KeyValueOptions> {
        const defaultOptions = KeyValue.defaultOptions();
        const finalOptions: DeepRequired<KeyValueOptions> = {
            dataConfig: {
                path:
                    options?.dataConfig?.path ?? defaultOptions.dataConfig.path,
                tables:
                    options?.dataConfig?.tables ??
                    defaultOptions.dataConfig.tables,
                referencePath: path.join(
                    options.dataConfig?.path ?? defaultOptions.dataConfig.path,
                    options?.dataConfig?.referencePath ??
                        defaultOptions.dataConfig.referencePath,
                ),
            },
            fileConfig: {
                extension:
                    options?.fileConfig?.extension ??
                    defaultOptions.fileConfig.extension,
                transactionLogPath: path.join(
                    options.dataConfig?.path ?? defaultOptions.dataConfig.path,
                    options?.fileConfig?.transactionLogPath ??
                        defaultOptions.fileConfig.transactionLogPath,
                ),
                maxSize:
                    options?.fileConfig?.maxSize ??
                    defaultOptions.fileConfig.maxSize,
            },
            encryptionConfig: {
                securityKey:
                    options?.encryptionConfig?.securityKey ??
                    defaultOptions.encryptionConfig.securityKey,
                encriptData:
                    options?.encryptionConfig?.encriptData ??
                    defaultOptions.encryptionConfig.encriptData,
            },
            cacheConfig: {
                cache:
                    options?.cacheConfig?.cache ??
                    defaultOptions.cacheConfig.cache,
                reference:
                    options?.cacheConfig?.reference ??
                    defaultOptions.cacheConfig.reference,
                limit:
                    options?.cacheConfig?.limit ??
                    defaultOptions.cacheConfig.limit,
                sorted:
                    options?.cacheConfig?.sorted ??
                    defaultOptions.cacheConfig.sorted,
                sortFunction:
                    options?.cacheConfig?.sortFunction ??
                    defaultOptions.cacheConfig.sortFunction,
            },
        };

        return finalOptions;
    }

    /**
     * @description connect to database
     *
     *
     * @example
     * ```js
     * <KeyValue>.connect()
     * ```
     */

    connect() {
        if (!existsSync(this.#options.dataConfig.path)) {
            mkdirSync(this.#options.dataConfig.path);
            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.dataConfig.path}/${table}`, {
                    recursive: true,
                });
                writeFileSync(
                    `${
                        this.#options.dataConfig.path
                    }/${table}/${table}_scheme_1${
                        this.#options.fileConfig.extension
                    }`,
                    JSON.stringify(
                        this.#options.encryptionConfig.encriptData
                            ? encrypt(
                                  `{}`,
                                  this.#options.encryptionConfig.securityKey,
                              )
                            : {},
                    ),
                );
            }

            if (!existsSync(`${this.#options.dataConfig.path}/.backup`)) {
                mkdirSync(`${this.#options.dataConfig.path}/.backup`);
            }
        }
        if (!existsSync(this.#options.dataConfig.referencePath)) {
            mkdirSync(this.#options.dataConfig.referencePath);
            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(
                    `${this.#options.dataConfig.referencePath}/${table}`,
                    {
                        recursive: true,
                    },
                );
                writeFileSync(
                    `${
                        this.#options.dataConfig.referencePath
                    }/${table}/reference_1.log`,
                    ``,
                );
            }
        }
        if (!existsSync(this.#options.fileConfig.transactionLogPath)) {
            mkdirSync(this.#options.fileConfig.transactionLogPath);

            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(
                    `${this.#options.fileConfig.transactionLogPath}/${table}`,
                    {
                        recursive: true,
                    },
                );
                writeFileSync(
                    `${
                        this.#options.fileConfig.transactionLogPath
                    }/${table}/transaction.log`,
                    `${randomBytes(16).toString("hex")}\n`,
                );

                writeFileSync(
                    `${
                        this.#options.fileConfig.transactionLogPath
                    }/${table}/fullWriter.log`,
                    ``,
                );
            }
        }

        for (const table of this.#options.dataConfig.tables) {
            const t = new Table(
                {
                    name: table,
                },
                this,
            );
            this.tables[table] = {
                table: t,
                ready: false,
            };
        }
        const isReady = (table: Table) => {
            this.readyAt = Date.now();
            this.tables[table.options.name].ready = true;
            if (Object.values(this.tables).every((t) => t.ready)) {
                this.emit(DatabaseEvents.Connect, table);
                this.removeListener(DatabaseEvents.TableReady, isReady);
            }
        };
        this.on(DatabaseEvents.TableReady, isReady);
    }
    get options() {
        return this.#options;
    }

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
    async set(
        table: string,
        key: string,
        value: Partial<KeyValueDataInterface>,
    ) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.set(key, value);
    }

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

    async get(table: string, key: string) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.get(key);
    }

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

    async delete(table: string, key: string) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.delete(key);
    }

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

    async clear(table: string) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.clear();
    }

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

    async has(table: string, key: string) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.has(key);
    }

    /**
     * @description clear all tables
     * @returns
     *
     * @example
     * ```js
     * <KeyValue>.clearAll();
     * ```
     */

    async clearAll() {
        for (const table of Object.keys(this.tables)) {
            await this.clear(table);
        }
    }

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
    async findOne(
        table: string,
        query: (value: Data, index: number) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.findOne(query);
    }

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

    async findMany(
        table: string,
        query: (value: Data, index: number) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.findMany(query);
    }

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

    async all(
        table: string,
        query?: (value: Data, index: number) => boolean,
        limit?: number,
    ) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.all(query, limit);
    }

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
    backup() {
        const backupPath = `${this.#options.dataConfig.path}/.backup`;
        const backupName = `${backupPath}/Snapshot_${new Date().toISOString()}.tar.gz`;
        const writer = createWriteStream(backupName);
        tar.c(
            {
                gzip: true,
            },
            [
                this.#options.dataConfig.referencePath,
                ...Object.keys(this.tables).map((table) => {
                    return `${this.#options.dataConfig.path}/${table}`;
                }),
                this.#options.fileConfig.transactionLogPath,
            ],
        ).pipe(writer);
    }

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

    async fullRepair(table: string) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.fullRepair();
    }

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

    async deleteMany(
        table: string,
        query?: (value: Data, index: number) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) return undefined;

        return await t.table.deleteMany(query);
    }
}
