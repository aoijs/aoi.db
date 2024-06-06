"use strict";
/**
 ** json file
 ** max keys 10k
 **
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const Data_js_1 = __importDefault(require("./Data.js"));
const Mutex_js_1 = __importDefault(require("./Mutex.js"));
class JSONFile {
    #options;
    #data = null;
    #tmpData = {};
    #fileHandle = null;
    #mutex;
    #maxTries = 10;
    constructor(options) {
        this.#options = options;
        this.#mutex = new Mutex_js_1.default();
    }
    async #load() {
        const data = await this.#fileHandle?.readFile();
        if (!data)
            return;
        this.#data = JSON.parse(data.toString());
    }
    async #readAllDataFromFile() {
        await this.#mutex.lock();
        return JSON.parse(((await this.#fileHandle?.readFile()) ?? "{}").toString());
    }
    async #atomicWrite() {
        const tmpPath = `${this.#options.filePath}.tmp`;
        const tmpHandle = await (0, promises_1.open)(tmpPath, promises_1.constants.O_RDWR | promises_1.constants.O_CREAT | promises_1.constants.O_TRUNC);
        await tmpHandle.writeFile(JSON.stringify(this.#data));
        await tmpHandle.close();
        await this.#fileHandle?.close();
        try {
            await (0, promises_1.rename)(tmpPath, this.#options.filePath);
        }
        catch (error) {
            if (this.#maxTries === 0) {
                this.#maxTries = 10;
                throw error;
            }
            await this.#atomicWrite();
            this.#maxTries--;
        }
        this.#fileHandle = await (0, promises_1.open)(this.#options.filePath, promises_1.constants.O_RDWR | promises_1.constants.O_CREAT);
    }
    async #atomicFlush(data) {
        const tmpPath = `${this.#options.filePath}.tmp`;
        const tmpHandle = await (0, promises_1.open)(tmpPath, promises_1.constants.O_RDWR | promises_1.constants.O_CREAT | promises_1.constants.O_TRUNC);
        const allFileData = await this.#readAllDataFromFile();
        for (const item of data) {
            if (item.deleted) {
                delete allFileData[item.key];
                continue;
            }
            allFileData[item.key] = item.toJSON();
        }
        await tmpHandle.writeFile(JSON.stringify(allFileData));
        await tmpHandle.close();
        await this.#fileHandle?.close();
        try {
            await (0, promises_1.rename)(tmpPath, this.#options.filePath);
        }
        catch (error) {
            if (this.#maxTries === 0) {
                this.#maxTries = 10;
                throw error;
            }
            await this.#atomicFlush(data);
            this.#maxTries--;
        }
        this.#fileHandle = await (0, promises_1.open)(this.#options.filePath, promises_1.constants.O_RDWR | promises_1.constants.O_CREAT);
        this.#data = this.#tmpData;
        this.#tmpData = {};
    }
    async open() {
        this.#fileHandle = await (0, promises_1.open)(this.#options.filePath, promises_1.constants.O_RDWR | promises_1.constants.O_CREAT);
        if (this.#options.loadInMemory) {
            await this.#load();
        }
    }
    async set(data) {
        await this.#mutex.lock();
        if (this.#data !== null) {
            for (const item of data) {
                if (item.deleted) {
                    delete this.#data[item.key];
                    continue;
                }
                this.#data[item.key] = item.toJSON();
            }
            await this.#atomicWrite();
        }
        else {
            for (const item of data) {
                this.#tmpData[item.key] = item;
            }
            await this.#atomicFlush(data);
        }
        this.#mutex.unlock();
    }
    async get(key) {
        await this.#mutex.lock();
        if (this.#data) {
            const data = this.#data[key];
            this.#mutex.unlock();
            return data
                ? Data_js_1.default.fromJSON(data, this.#options.filePath)
                : Data_js_1.default.emptyData();
        }
        if (this.#tmpData[key]) {
            this.#mutex.unlock();
            if (this.#tmpData[key].deleted) {
                return null;
            }
            return Data_js_1.default.fromJSON(this.#tmpData[key], this.#options.filePath);
        }
        const allData = await this.#readAllDataFromFile();
        this.#mutex.unlock();
        const data = allData[key];
        return data ? Data_js_1.default.fromJSON(data, this.#options.filePath) : null;
    }
    async findMany(query) {
        await this.#mutex.lock();
        const list = [];
        if (this.#data) {
            for (const key in this.#data) {
                if (query(this.#data[key])) {
                    list.push(Data_js_1.default.fromJSON(this.#data[key], this.#options.filePath));
                }
            }
            this.#mutex.unlock();
            return list;
        }
        else {
            for (const key in this.#tmpData) {
                if (query(this.#tmpData[key]) && !this.#tmpData[key].deleted) {
                    list.push(this.#tmpData[key]);
                }
            }
            const allData = await this.#readAllDataFromFile();
            this.#mutex.unlock();
            for (const key in allData) {
                if (query(allData[key])) {
                    list.push(Data_js_1.default.fromJSON(allData[key], this.#options.filePath));
                }
            }
            return list;
        }
    }
    async findOne(query) {
        await this.#mutex.lock();
        if (this.#data) {
            for (const key in this.#data) {
                if (query(this.#data[key])) {
                    this.#mutex.unlock();
                    return Data_js_1.default.fromJSON(this.#data[key], this.#options.filePath);
                }
            }
            this.#mutex.unlock();
            return null;
        }
        else {
            for (const key in this.#tmpData) {
                if (query(this.#tmpData[key]) && !this.#tmpData[key].deleted) {
                    this.#mutex.unlock();
                    return this.#tmpData[key];
                }
            }
            const allData = await this.#readAllDataFromFile();
            this.#mutex.unlock();
            for (const key in allData) {
                if (query(allData[key])) {
                    return Data_js_1.default.fromJSON(allData[key], this.#options.filePath);
                }
            }
            return null;
        }
    }
    async all(query, order = "asc", start = 0, length = 10) {
        const list = await this.findMany(query);
        if (order === "asc") {
            return list
                .sort((a, b) => a.value - b.value)
                .slice(start, start + length);
        }
        else if (order === "desc") {
            return list
                .sort((a, b) => b.value - a.value)
                .slice(start, start + length);
        }
        else {
            return list.slice(start, start + length);
        }
    }
}
exports.default = JSONFile;
//# sourceMappingURL=File.js.map