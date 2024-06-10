import EventEmitter from "node:events";
import FileManager from "./FileManager.js";
import fsp from "node:fs/promises";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { createHash, createHashRawString, decodeHash, stringify, } from "../../utils.js";
import Data from "./data.js";
import { setTimeout } from "node:timers/promises";
export default class Table extends EventEmitter {
    #options;
    #db;
    #fileManager;
    locked = false;
    isFlushing = false;
    paths;
    logData;
    readyAt = -1;
    constructor(options, db) {
        super();
        this.#options = options;
        this.#db = db;
        this.#fileManager = new FileManager(db.options.fileConfig.maxSize, db.options.fileConfig.minFileCount, this);
    }
    get options() {
        return this.#options;
    }
    get db() {
        return this.#db;
    }
    get fileManager() {
        return this.#fileManager;
    }
    async initialize() {
        this.#getPaths();
        await this.#getLogData();
        await this.#fileManager.initialize();
        await setTimeout(100);
        await this.#syncWithLog();
        this.readyAt = Date.now();
        this.#db.emit(DatabaseEvents.TableReady, this);
    }
    #getPaths() {
        const { path } = this.#db.options.dataConfig;
        const { transactionLogPath } = this.#db.options.fileConfig;
        const { name } = this.#options;
        this.paths = {
            log: `${transactionLogPath}/${name}/transaction.log`,
            table: `${path}/${name}`,
        };
    }
    async #getLogData() {
        const filehandle = await fsp.open(this.paths.log, fsp.constants.O_RDWR | fsp.constants.O_CREAT);
        let size = 0;
        let logIV = "";
        for await (const line of filehandle.readLines({
            autoClose: false,
            emitClose: false,
        })) {
            size++;
            if (size === 1) {
                logIV = line;
                size++;
            }
        }
        this.logData = {
            fd: filehandle,
            size,
            fileSize: (await filehandle.stat()).size,
            logIV,
        };
    }
    async getLogs() {
        const logs = [];
        const { securityKey } = this.#db.options.encryptionConfig;
        for await (const line of this.logData.fd.readLines({
            autoClose: false,
            emitClose: false,
            start: 33,
        })) {
            const [key, value, type, ttl, method] = decodeHash(line, securityKey, this.logData.logIV);
            let parsedMethod;
            if (!method)
                parsedMethod = Number(ttl);
            else
                parsedMethod = Number(method);
            logs.push({
                key,
                value,
                type: type,
                method: parsedMethod,
            });
        }
        return logs;
    }
    async #syncWithLog() {
        const logs = await this.getLogs();
        const lastFlushIndex = logs.findLastIndex((log) => log.method === DatabaseMethod.Flush);
        const startIndex = lastFlushIndex === -1 ? 0 : lastFlushIndex + 1;
        for (let i = startIndex; i < logs.length; i++) {
            const log = logs[i];
            if (log.method === DatabaseMethod.Set) {
                const data = new Data({
                    key: log.key,
                    value: log.value,
                    type: log.type,
                    file: "",
                });
                this.#fileManager.add(data);
            }
            else if (log.method === DatabaseMethod.Delete) {
                this.#fileManager.remove(log.key);
            }
        }
        await this.#wal(Data.emptyData(), DatabaseMethod.Flush);
    }
    async #wal(data, method) {
        const { key, type, value } = data.toJSON();
        const { securityKey } = this.#db.options.encryptionConfig;
        const delimitedString = createHashRawString([
            key,
            stringify(value),
            type,
            method.toString(),
        ]);
        const logHash = createHash(delimitedString, securityKey, this.logData.logIV);
        await this.logData.fd.appendFile(logHash + '\n', {
            flush: true,
        });
        this.logData.fileSize += logHash.length + 1;
        this.logData.size++;
        if (method === DatabaseMethod.Flush && this.logData.size > this.#db.options.fileConfig.maxSize / 4) {
            await this.logData.fd.truncate(33);
        }
    }
    async wal(data, method) {
        return this.#wal(data, method);
    }
    async set(key, value, type) {
        const data = new Data({ key, value, type, file: "" });
        this.#fileManager.add(data);
        await this.#wal(data, DatabaseMethod.Set);
    }
    async get(key) {
        return this.#fileManager.get(key);
    }
    async delete(key) {
        this.#fileManager.remove(key);
        await this.#wal(Data.emptyData(), DatabaseMethod.Delete);
    }
    async clear() {
        this.#fileManager.clear();
        await this.#wal(Data.emptyData(), DatabaseMethod.Clear);
    }
    async has(key) {
        return this.#fileManager.has(key);
    }
    async all(query, limit, order) {
        return this.#fileManager.all(query, limit, order);
    }
    async findOne(query) {
        return this.#fileManager.findOne(query);
    }
    async findMany(query) {
        return this.#fileManager.findMany(query);
    }
    async removeMany(query) {
        return this.#fileManager.removeMany(query);
    }
    async ping() {
        return this.#fileManager.ping();
    }
}
//# sourceMappingURL=Table.js.map