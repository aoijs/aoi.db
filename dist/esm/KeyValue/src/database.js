import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { CacheType, ReferenceType, DatabaseEvents, } from "../../typings/enum.js";
import { encrypt } from "../../utils.js";
import Table from "./Table.js";
import { EventEmitter } from "events";
//zipping and unzipping
import tar from "tar";
import path from "path";
export default class KeyValue extends EventEmitter {
    #options;
    tables = {};
    readyAt;
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
    constructor(options) {
        super();
        this.#options = this.#finalizeOptions(options);
    }
    /**
     * @description get default options
     * @static
     * @returns default options
     */
    static defaultOptions() {
        return {
            dataConfig: {
                path: "./database",
                tables: ["main"],
                referencePath: "./reference/",
            },
            fileConfig: {
                extension: ".sql",
                reHashOnStartup: false,
                staticRehash: false,
                transactionLogPath: "./transaction/",
                maxSize: 10000,
                minFileCount: 10,
            },
            encryptionConfig: {
                securityKey: "a-32-characters-long-string-here",
                encriptData: false,
            },
            cacheConfig: {
                cache: CacheType.LRU,
                reference: ReferenceType.Cache,
                limit: 1000,
                sorted: false,
                sortFunction: (a, b) => {
                    return a.value - b.value;
                },
            },
            debug: false,
        };
    }
    /**
     * @private
     * @description finalize options
     * @param options options to finalize
     * @returns
     */
    #finalizeOptions(options) {
        const defaultOptions = KeyValue.defaultOptions();
        const finalOptions = {
            dataConfig: {
                path: options?.dataConfig?.path ?? defaultOptions.dataConfig.path,
                tables: options?.dataConfig?.tables ??
                    defaultOptions.dataConfig.tables,
                referencePath: path.join(options.dataConfig?.path ?? defaultOptions.dataConfig.path, options?.dataConfig?.referencePath ??
                    defaultOptions.dataConfig.referencePath),
            },
            fileConfig: {
                extension: options?.fileConfig?.extension ??
                    defaultOptions.fileConfig.extension,
                transactionLogPath: path.join(options.dataConfig?.path ?? defaultOptions.dataConfig.path, options?.fileConfig?.transactionLogPath ??
                    defaultOptions.fileConfig.transactionLogPath),
                reHashOnStartup: options?.fileConfig?.reHashOnStartup ?? false,
                staticRehash: options?.fileConfig?.staticRehash ?? defaultOptions.fileConfig.staticRehash,
                maxSize: options?.fileConfig?.maxSize ??
                    defaultOptions.fileConfig.maxSize,
                minFileCount: options?.fileConfig?.minFileCount ??
                    defaultOptions.fileConfig.minFileCount,
            },
            encryptionConfig: {
                securityKey: options?.encryptionConfig?.securityKey ??
                    defaultOptions.encryptionConfig.securityKey,
                encriptData: options?.encryptionConfig?.encriptData ??
                    defaultOptions.encryptionConfig.encriptData,
            },
            cacheConfig: {
                cache: options?.cacheConfig?.cache ??
                    defaultOptions.cacheConfig.cache,
                reference: options?.cacheConfig?.reference ??
                    defaultOptions.cacheConfig.reference,
                limit: options?.cacheConfig?.limit ??
                    defaultOptions.cacheConfig.limit,
                sorted: options?.cacheConfig?.sorted ??
                    defaultOptions.cacheConfig.sorted,
                sortFunction: options?.cacheConfig?.sortFunction ??
                    defaultOptions.cacheConfig.sortFunction,
            },
            debug: options?.debug ?? defaultOptions.debug,
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
    async connect() {
        const isReady = (table) => {
            this.tables[table.options.name].ready = true;
            for (const t of this.#options.dataConfig.tables) {
                if (!this.tables[t]?.ready)
                    return;
            }
            this.readyAt = Date.now();
            this.removeListener(DatabaseEvents.TableReady, isReady);
            this.emit(DatabaseEvents.Connect);
        };
        this.on(DatabaseEvents.TableReady, isReady);
        if (!existsSync(this.#options.dataConfig.path)) {
            mkdirSync(this.#options.dataConfig.path);
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!existsSync(`${this.#options.dataConfig.path}/${table}`)) {
                mkdirSync(`${this.#options.dataConfig.path}/${table}`);
                writeFileSync(`${this.#options.dataConfig.path}/${table}/${table}_scheme_1${this.#options.fileConfig.extension}`, JSON.stringify(this.#options.encryptionConfig.encriptData
                    ? encrypt(`{}`, this.#options.encryptionConfig.securityKey)
                    : {}));
            }
        }
        // if (!existsSync(this.#options.dataConfig.referencePath)) {
        //     mkdirSync(this.#options.dataConfig.referencePath);
        // }
        // for (const table of this.#options.dataConfig.tables) {
        //     if (
        //         !existsSync(
        //             `${this.#options.dataConfig.referencePath}/${table}`,
        //         )
        //     ) {
        //         mkdirSync(
        //             `${this.#options.dataConfig.referencePath}/${table}`,
        //             {
        //                 recursive: true,
        //             },
        //         );
        //         writeFileSync(
        //             `${
        //                 this.#options.dataConfig.referencePath
        //             }/${table}/reference_1.log`,
        //             ``,
        //         );
        //     }
        // }
        if (!existsSync(this.#options.fileConfig.transactionLogPath)) {
            mkdirSync(this.#options.fileConfig.transactionLogPath);
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!existsSync(`${this.#options.fileConfig.transactionLogPath}/${table}`)) {
                mkdirSync(`${this.#options.fileConfig.transactionLogPath}/${table}`, {
                    recursive: true,
                });
                writeFileSync(`${this.#options.fileConfig.transactionLogPath}/${table}/transaction.log`, `${randomBytes(16).toString("hex")}\n`);
                // writeFileSync(
                //     `${
                //         this.#options.fileConfig.transactionLogPath
                //     }/${table}/fullWriter.log`,
                //     ``,
                // );
            }
        }
        if (!existsSync(`${this.#options.dataConfig.path}/.backup`)) {
            mkdirSync(`${this.#options.dataConfig.path}/.backup`, {
                recursive: true
            });
        }
        const promises = [];
        for (const table of this.#options.dataConfig.tables) {
            const t = new Table({
                name: table,
            }, this);
            this.tables[table] = {
                table: t,
                ready: false,
            };
            promises.push(t.initialize());
        }
        await Promise.all(promises);
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
    async set(table, key, value) {
        const t = this.tables[table];
        if (!t)
            return undefined;
        return await t.table.set(key, value.value, value.type);
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
    async get(table, key) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async delete(table, key) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async clear(table) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async has(table, key) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async findOne(table, query) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async findMany(table, query) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async all(table, query, limit, order = 'firstN') {
        const t = this.tables[table];
        if (!t)
            return undefined;
        return await t.table.all(query ?? (() => true), limit ?? 100, order);
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
        const backupName = `${backupPath}/Snapshot_${new Date()
            .toISOString()
            .replaceAll(" ", "_")
            .replaceAll(",", "_")
            .replaceAll(":", "_")}.tar.gz`;
        writeFileSync(backupName, "");
        const writer = createWriteStream(backupName);
        tar.c({
            gzip: true,
        }, [
            this.#options.dataConfig.referencePath,
            ...Object.keys(this.tables).map((table) => {
                return `${this.#options.dataConfig.path}/${table}`;
            }),
            this.#options.fileConfig.transactionLogPath,
        ]).pipe(writer);
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
    // async fullRepair(table: string) {
    //     const t = this.tables[table];
    //     if (!t) return undefined;
    //     return await t.table.fullRepair();
    // }
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
    async deleteMany(table, query) {
        const t = this.tables[table];
        if (!t)
            return undefined;
        return await t.table.removeMany(query ?? (() => true));
    }
    async ping(table) {
        const t = this.tables[table];
        if (!t)
            return 0;
        return await t.table.ping();
    }
    async avgPing() {
        let total = 0;
        for (const table of Object.keys(this.tables)) {
            total += await this.ping(table);
        }
        return total / Object.keys(this.tables).length;
    }
}
//# sourceMappingURL=database.js.map