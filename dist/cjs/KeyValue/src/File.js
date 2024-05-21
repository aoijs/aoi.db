"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_js_1 = __importDefault(require("./data.js"));
const LRUcache_js_1 = __importDefault(require("./LRUcache.js"));
const node_fs_1 = __importDefault(require("node:fs"));
const utils_js_1 = require("../../utils.js");
const promisifiers_js_1 = require("../../promisifiers.js");
const enum_js_1 = require("../../typings/enum.js");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const Mutex_js_1 = __importDefault(require("./Mutex.js"));
class File {
    #cache;
    #path;
    #fd;
    #size;
    #locked = false;
    #isDirty;
    #flushQueue;
    #removeQueue;
    #interval;
    #retries = 0;
    #table;
    #mutex = new Mutex_js_1.default();
    constructor(path, capacity, table) {
        this.#cache = new LRUcache_js_1.default(capacity);
        this.#path = path;
        this.#table = table;
        this.#size = 0;
        this.#isDirty = false;
        this.#flushQueue = [];
        this.#removeQueue = [];
        // Open file
        this.#fd = node_fs_1.default.openSync(this.#path, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
    }
    async init() {
        const statSize = await (0, promisifiers_js_1.fstat)(this.#fd);
        if (statSize.size === 0) {
            await (0, promisifiers_js_1.write)(this.#fd, Buffer.from("{}"), 0, 2, 0);
        }
        await this.#checkIntegrity().catch((e) => {
            this.#isDirty = true;
            throw e;
        });
        this.#enableInterval();
    }
    get name() {
        return this.#path.split("/").pop().split(".")[0];
    }
    #enableInterval() {
        if (this.#isDirty)
            return;
        this.#interval = setInterval(async () => {
            if (this.#flushQueue.length === 0 &&
                this.#removeQueue.length === 0) {
                return;
            }
            await this.#atomicFlush();
        }, 500);
    }
    get size() {
        return this.#size;
    }
    get path() {
        return this.#path;
    }
    get cache() {
        return this.#cache;
    }
    get isDirty() {
        return this.#isDirty;
    }
    get locked() {
        return this.#mutex.isLocked();
    }
    get flushQueue() {
        return this.#flushQueue;
    }
    get interval() {
        return this.#interval;
    }
    async #checkIntegrity() {
        await new Promise(async (resolve, reject) => {
            try {
                if (!this.#table.db.options.fileConfig.staticRehash) {
                    await this.getAll();
                    resolve();
                }
                else {
                    // const jsonstream = JSONStream.parse("*");
                    // const stream = fs.createReadStream(this.#path);
                    // stream.pipe(jsonstream);
                    // jsonstream.on("data", (data: KeyValueJSONOption) => {
                    // 	this.#size++;
                    // 	this.#cache.put(
                    // 		data.key,
                    // 		new Data({
                    // 			key: data.key,
                    // 			value: data.value,
                    // 			type: data.type,
                    // 			file: this.#path,
                    // 		})
                    // 	);
                    // });
                    // jsonstream.on("end", () => {
                    // 	resolve();
                    // });
                    const json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, "utf-8"));
                    resolve();
                }
            }
            catch (e) {
                this.#isDirty = true;
                reject(e);
            }
        });
    }
    async get(key) {
        if (this.#cache.has(key)) {
            return this.#cache.get(key);
        }
        const idx = this.#flushQueue.findIndex((data) => data.key === key);
        if (idx !== -1) {
            return this.#flushQueue[idx];
        }
        if (this.#isDirty) {
            return;
        }
        const value = await this.#getFromDisk(key);
        return value;
    }
    async #getFromDisk(key) {
        await this.#mutex.lock();
        let value;
        try {
            let json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, "utf-8"));
            if (this.#table.db.options.encryptionConfig.encriptData) {
                const decryptedData = (0, utils_js_1.decrypt)(json, this.#table.db.options.encryptionConfig.securityKey);
                json = JSON.parse(decryptedData);
            }
            if (json[key]) {
                value = new data_js_1.default({
                    key: key,
                    value: json[key].value,
                    type: json[key].type,
                    file: this.#path,
                });
                this.#cache.put(key, value);
            }
        }
        finally {
            this.#mutex.unlock();
        }
        return value;
    }
    async put(key, value) {
        this.#cache.put(key, value);
        this.#size++;
        this.#flushQueue.push(value);
    }
    async #atomicFlush() {
        await this.#mutex.lock();
        const dir = node_path_1.default.dirname(this.#path);
        const opendir = await node_fs_1.default.promises.open(dir, node_fs_1.default.constants.O_RDONLY | node_fs_1.default.constants.O_DIRECTORY);
        const tempFile = `${this.#path}.tmp`;
        const tmpfd = node_fs_1.default.openSync(tempFile, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
        let json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, "utf-8"));
        if (this.#table.db.options.encryptionConfig.encriptData) {
            const decryptedData = (0, utils_js_1.decrypt)(json, this.#table.db.options.encryptionConfig.securityKey);
            json = decryptedData;
        }
        for (const data of this.#flushQueue) {
            json[data.key] = data;
        }
        for (const data of this.#removeQueue) {
            delete json[data];
        }
        let writeData;
        if (this.#table.db.options.encryptionConfig.encriptData) {
            writeData = JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(json), this.#table.db.options.encryptionConfig.securityKey));
        }
        else {
            writeData = JSON.stringify(json);
        }
        const buffer = Buffer.from(writeData);
        await (0, promisifiers_js_1.write)(tmpfd, buffer, 0, buffer.length, 0);
        await (0, promisifiers_js_1.fsync)(tmpfd);
        await (0, promisifiers_js_1.close)(tmpfd);
        await (0, promisifiers_js_1.close)(this.#fd);
        await this.#retry(async () => {
            if ((0, node_os_1.platform)() === "win32") {
                await node_fs_1.default.promises.unlink(this.#path);
                await node_fs_1.default.promises.rename(tempFile, this.#path);
                await opendir.sync();
                await opendir.close();
            }
            else {
                await node_fs_1.default.promises.rename(tempFile, this.#path);
                await opendir.sync();
                await opendir.close();
            }
        }, 10, 100);
        this.#fd = node_fs_1.default.openSync(this.#path, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
        this.#flushQueue = [];
        this.#removeQueue = [];
        await this.#table.wal(data_js_1.default.emptyData(), enum_js_1.DatabaseMethod.Flush);
        this.#mutex.unlock();
    }
    async #retry(fn, maxRetries = 10, delay = 100) {
        try {
            return await fn();
        }
        catch (error) {
            if (this.#retries >= maxRetries) {
                this.#retries = 0;
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            this.#retries++;
            return await this.#retry(fn, maxRetries, delay);
        }
    }
    async getAll(query) {
        if (!query)
            query = () => true;
        await this.#mutex.lock();
        let json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, { encoding: "utf-8" }));
        const arr = [];
        if (this.#table.db.options.encryptionConfig.encriptData) {
            const decryptedData = (0, utils_js_1.decrypt)(json, this.#table.db.options.encryptionConfig.securityKey);
            json = JSON.parse(decryptedData);
        }
        for (const key in json) {
            if (query(json[key])) {
                const data = new data_js_1.default({
                    key: json[key].key,
                    value: json[key].value,
                    type: json[key].type,
                    file: this.#path,
                });
                this.#cache.put(key, data);
                arr.push(data);
            }
        }
        this.#mutex.unlock();
        return arr;
    }
    async findOne(query) {
        if (!query)
            query = () => true;
        const f = this.#cache.findOne(query);
        if (f)
            return f;
        await this.#mutex.lock();
        let json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, { encoding: "utf-8" }));
        this.#mutex.unlock();
        if (this.#table.db.options.encryptionConfig.encriptData) {
            const decryptedData = (0, utils_js_1.decrypt)(json, this.#table.db.options.encryptionConfig.securityKey);
            json = JSON.parse(decryptedData);
        }
        for (const key in json) {
            if (query(json[key])) {
                const data = new data_js_1.default({
                    key: json[key].key,
                    value: json[key].value,
                    type: json[key].type,
                    file: this.#path,
                });
                this.#cache.put(key, data);
                return data;
            }
        }
    }
    async remove(data) {
        this.#removeQueue.push(data);
        this.#size--;
        this.#cache.remove(data);
    }
    async clear() {
        this.#cache.clear();
        this.#size = 0;
        this.#flushQueue = [];
        this.#removeQueue = [];
        await (0, promisifiers_js_1.ftruncate)(this.#fd, 0);
        const buffer = Buffer.from("{}");
        await (0, promisifiers_js_1.write)(this.#fd, buffer, 0, buffer.length, 0);
    }
    async #has(key) {
        await this.#mutex.lock();
        let json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, { encoding: "utf-8" }));
        if (this.#table.db.options.encryptionConfig.encriptData) {
            const decryptedData = (0, utils_js_1.decrypt)(json, this.#table.db.options.encryptionConfig.securityKey);
            json = JSON.parse(decryptedData);
        }
        this.#mutex.unlock();
        return !!json[key];
    }
    async has(key) {
        if (this.#cache.has(key))
            return true;
        const idx = this.#flushQueue.findIndex((data) => data.key === key);
        if (idx !== -1) {
            return true;
        }
        if (this.#isDirty) {
            return false;
        }
        const value = await this.#has(key).catch((_) => false);
        return value ? true : false;
    }
    async removeMany(query) {
        await this.#mutex.lock();
        let json = JSON.parse(await node_fs_1.default.promises.readFile(this.#path, { encoding: "utf-8" }));
        this.#mutex.unlock();
        if (this.#table.db.options.encryptionConfig.encriptData) {
            const decryptedData = (0, utils_js_1.decrypt)(json, this.#table.db.options.encryptionConfig.securityKey);
            json = JSON.parse(decryptedData);
        }
        for (const key in json) {
            if (query(json[key])) {
                delete json[key];
            }
        }
        let writeData;
        if (this.#table.db.options.encryptionConfig.encriptData) {
            writeData = JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(json), this.#table.db.options.encryptionConfig.securityKey));
        }
        else {
            writeData = JSON.stringify(json);
        }
        await this.#atomicWrite(writeData);
    }
    async #atomicWrite(data) {
        await this.#mutex.lock();
        const dir = node_path_1.default.dirname(this.#path);
        const opendir = await node_fs_1.default.promises.open(dir, node_fs_1.default.constants.O_RDONLY | node_fs_1.default.constants.O_DIRECTORY);
        const tempFile = `${this.#path}.tmp`;
        const tmpfd = node_fs_1.default.openSync(tempFile, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
        const buffer = Buffer.from(data);
        await (0, promisifiers_js_1.write)(tmpfd, buffer, 0, buffer.length, 0);
        await (0, promisifiers_js_1.fsync)(tmpfd);
        await (0, promisifiers_js_1.close)(tmpfd);
        await (0, promisifiers_js_1.close)(this.#fd);
        await this.#retry(async () => {
            if ((0, node_os_1.platform)() === "win32") {
                await node_fs_1.default.promises.unlink(this.#path);
                await node_fs_1.default.promises.rename(tempFile, this.#path);
                this.#fd = await (0, promisifiers_js_1.open)(this.#path, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
                await opendir.sync();
                await opendir.close();
            }
            else {
                await node_fs_1.default.promises.rename(tempFile, this.#path);
                this.#fd = await (0, promisifiers_js_1.open)(this.#path, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
                await opendir.sync();
                await opendir.close();
            }
        }, 10, 100);
        this.#fd = await (0, promisifiers_js_1.open)(this.#path, node_fs_1.default.constants.O_RDWR | node_fs_1.default.constants.O_CREAT);
        this.#mutex.unlock();
    }
    async ping() {
        const startTime = performance.now();
        await this.findOne(() => true);
        return performance.now() - startTime;
    }
    async unlink() {
        clearInterval(this.#interval);
        await node_fs_1.default.promises.unlink(this.#path);
    }
    async lockAndsync() {
        // remove interval
        clearInterval(this.#interval);
        await (0, promisifiers_js_1.fsync)(this.#fd);
    }
}
exports.default = File;
//# sourceMappingURL=File.js.map