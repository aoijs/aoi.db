"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const enum_js_1 = require("../../typings/enum.js");
const utils_js_1 = require("../../utils.js");
const newtable_js_1 = __importDefault(require("./newtable.js"));
const events_1 = require("events");
//zipping and unzipping
const tar_1 = __importDefault(require("tar"));
const path_1 = __importDefault(require("path"));
class KeyValue extends events_1.EventEmitter {
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
                transactionLogPath: "./transaction/",
                maxSize: 20 * 1024 * 1024,
            },
            encryptionConfig: {
                securityKey: "a-32-characters-long-string-here",
                encriptData: false,
            },
            cacheConfig: {
                cache: enum_js_1.CacheType.LRU,
                reference: enum_js_1.ReferenceType.Cache,
                limit: 1000,
                sorted: false,
                sortFunction: (a, b) => {
                    return 0;
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
                referencePath: path_1.default.join(options.dataConfig?.path ?? defaultOptions.dataConfig.path, options?.dataConfig?.referencePath ??
                    defaultOptions.dataConfig.referencePath),
            },
            fileConfig: {
                extension: options?.fileConfig?.extension ??
                    defaultOptions.fileConfig.extension,
                transactionLogPath: path_1.default.join(options.dataConfig?.path ?? defaultOptions.dataConfig.path, options?.fileConfig?.transactionLogPath ??
                    defaultOptions.fileConfig.transactionLogPath),
                maxSize: options?.fileConfig?.maxSize ??
                    defaultOptions.fileConfig.maxSize,
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
            this.removeListener(enum_js_1.DatabaseEvents.TableReady, isReady);
            this.emit(enum_js_1.DatabaseEvents.Connect);
        };
        this.on(enum_js_1.DatabaseEvents.TableReady, isReady);
        if (!(0, fs_1.existsSync)(this.#options.dataConfig.path)) {
            (0, fs_1.mkdirSync)(this.#options.dataConfig.path);
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!(0, fs_1.existsSync)(`${this.#options.dataConfig.path}/${table}`)) {
                (0, fs_1.mkdirSync)(`${this.#options.dataConfig.path}/${table}`);
                (0, fs_1.writeFileSync)(`${this.#options.dataConfig.path}/${table}/${table}_scheme_1${this.#options.fileConfig.extension}`, JSON.stringify(this.#options.encryptionConfig.encriptData
                    ? (0, utils_js_1.encrypt)(`{}`, this.#options.encryptionConfig.securityKey)
                    : {}));
            }
        }
        if (!(0, fs_1.existsSync)(this.#options.dataConfig.referencePath)) {
            (0, fs_1.mkdirSync)(this.#options.dataConfig.referencePath);
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!(0, fs_1.existsSync)(`${this.#options.dataConfig.referencePath}/${table}`)) {
                (0, fs_1.mkdirSync)(`${this.#options.dataConfig.referencePath}/${table}`, {
                    recursive: true,
                });
                (0, fs_1.writeFileSync)(`${this.#options.dataConfig.referencePath}/${table}/reference_1.log`, ``);
            }
        }
        if (!(0, fs_1.existsSync)(this.#options.fileConfig.transactionLogPath)) {
            (0, fs_1.mkdirSync)(this.#options.fileConfig.transactionLogPath);
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!(0, fs_1.existsSync)(`${this.#options.fileConfig.transactionLogPath}/${table}`)) {
                (0, fs_1.mkdirSync)(`${this.#options.fileConfig.transactionLogPath}/${table}`, {
                    recursive: true,
                });
                (0, fs_1.writeFileSync)(`${this.#options.fileConfig.transactionLogPath}/${table}/transaction.log`, `${(0, crypto_1.randomBytes)(16).toString("hex")}\n`);
                (0, fs_1.writeFileSync)(`${this.#options.fileConfig.transactionLogPath}/${table}/fullWriter.log`, ``);
            }
        }
        if (!(0, fs_1.existsSync)(`${this.#options.dataConfig.path}/.backup`)) {
            (0, fs_1.mkdirSync)(`${this.#options.dataConfig.path}/.backup`, {
                recursive: true
            });
        }
        for (const table of this.#options.dataConfig.tables) {
            const t = new newtable_js_1.default({
                name: table,
            }, this);
            this.tables[table] = {
                table: t,
                ready: false,
            };
            await t.initialize();
        }
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
        (0, fs_1.writeFileSync)(backupName, "");
        const writer = (0, fs_1.createWriteStream)(backupName);
        tar_1.default.c({
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
    async fullRepair(table) {
        const t = this.tables[table];
        if (!t)
            return undefined;
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
    async deleteMany(table, query) {
        const t = this.tables[table];
        if (!t)
            return undefined;
        return await t.table.deleteMany(query ?? (() => true));
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
exports.default = KeyValue;
//# sourceMappingURL=database.js.map