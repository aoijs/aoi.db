"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_events_1 = __importDefault(require("node:events"));
const FileManager_js_1 = __importDefault(require("./FileManager.js"));
const node_fs_1 = __importDefault(require("node:fs"));
const enum_js_1 = require("../../typings/enum.js");
const utils_js_1 = require("../../utils.js");
const data_js_1 = __importDefault(require("./data.js"));
const promises_1 = require("node:readline/promises");
const promisifiers_js_1 = require("../../promisifiers.js");
const promises_2 = require("node:timers/promises");
class Table extends node_events_1.default {
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
        this.#fileManager = new FileManager_js_1.default(db.options.fileConfig.maxSize, db.options.fileConfig.minFileCount, this);
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
        await (0, promises_2.setTimeout)(100);
        await this.#syncWithLog();
        this.readyAt = Date.now();
        this.#db.emit(enum_js_1.DatabaseEvents.TableReady, this);
    }
    async #getPaths() {
        const { path } = this.#db.options.dataConfig;
        const { transactionLogPath } = this.#db.options.fileConfig;
        const { name } = this.#options;
        this.paths = {
            log: `${transactionLogPath}/${name}/transaction.log`,
            table: `${path}/${name}`,
        };
    }
    async #getLogData() {
        let size = 0;
        let logIV = "";
        const stream = node_fs_1.default.createReadStream(this.paths.log, {
            encoding: "utf-8",
            highWaterMark: 33,
        });
        const rl = (0, promises_1.createInterface)({
            input: stream,
            crlfDelay: Infinity,
        });
        for await (const line of rl) {
            size++;
            if (size === 1) {
                logIV = line;
            }
        }
        this.logData = {
            fd: node_fs_1.default.openSync(this.paths.log, "a+"),
            size,
            fileSize: node_fs_1.default.statSync(this.paths.log).size,
            logIV,
        };
    }
    async getLogs() {
        const logs = [];
        let ignoreFirstLine = true;
        const { securityKey } = this.#db.options.encryptionConfig;
        const stream = node_fs_1.default.createReadStream(this.paths.log, {
            encoding: "utf-8",
        });
        const rl = (0, promises_1.createInterface)({
            input: stream,
            crlfDelay: Infinity,
        });
        for await (const line of rl) {
            if (ignoreFirstLine)
                ignoreFirstLine = false;
            else {
                const [key, value, type, ttl, method] = (0, utils_js_1.decodeHash)(line, securityKey, this.logData.logIV);
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
        }
        return logs;
    }
    async #syncWithLog() {
        const logs = await this.getLogs();
        const lastFlushIndex = logs.findLastIndex((log) => log.method === enum_js_1.DatabaseMethod.Flush);
        const startIndex = lastFlushIndex === -1 ? 0 : lastFlushIndex + 1;
        for (let i = startIndex; i < logs.length; i++) {
            const log = logs[i];
            if (log.method === enum_js_1.DatabaseMethod.Set) {
                const data = new data_js_1.default({
                    key: log.key,
                    value: log.value,
                    type: log.type,
                    file: "",
                });
                this.#fileManager.add(data);
            }
            else if (log.method === enum_js_1.DatabaseMethod.Delete) {
                this.#fileManager.remove(log.key);
            }
        }
        await this.#wal(data_js_1.default.emptyData(), enum_js_1.DatabaseMethod.Flush);
    }
    async #wal(data, method) {
        return new Promise(async (resolve) => {
            const { key, type, value } = data.toJSON();
            const { securityKey } = this.#db.options.encryptionConfig;
            const delimitedString = (0, utils_js_1.createHashRawString)([
                key,
                (0, utils_js_1.stringify)(value),
                type,
                method.toString(),
            ]);
            const logHash = (0, utils_js_1.createHash)(delimitedString, securityKey, this.logData.logIV);
            const { bytesWritten } = await (0, promisifiers_js_1.write)(this.logData.fd, logHash + "\n", this.logData.fileSize, "utf-8");
            this.logData.fileSize += bytesWritten;
            this.logData.size++;
            if (method === enum_js_1.DatabaseMethod.Flush &&
                this.logData.size > this.#db.options.fileConfig.maxSize) {
                await (0, promisifiers_js_1.ftruncate)(this.logData.fd, 33);
            }
            resolve();
            return;
        });
    }
    async wal(data, method) {
        return this.#wal(data, method);
    }
    async set(key, value, type) {
        const data = new data_js_1.default({ key, value, type, file: "" });
        this.#fileManager.add(data);
        await this.#wal(data, enum_js_1.DatabaseMethod.Set);
    }
    async get(key) {
        return this.#fileManager.get(key);
    }
    async delete(key) {
        this.#fileManager.remove(key);
        await this.#wal(data_js_1.default.emptyData(), enum_js_1.DatabaseMethod.Delete);
    }
    async clear() {
        this.#fileManager.clear();
        await this.#wal(data_js_1.default.emptyData(), enum_js_1.DatabaseMethod.Clear);
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
exports.default = Table;
//# sourceMappingURL=Table.js.map