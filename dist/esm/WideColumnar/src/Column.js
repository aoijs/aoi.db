"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const MemMap_js_1 = __importDefault(require("./MemMap.js"));
const Data_js_1 = __importDefault(require("./Data.js"));
const crypto_1 = require("crypto");
const promises_2 = require("fs/promises");
const promises_3 = __importDefault(require("readline/promises"));
const utils_js_1 = require("../../utils.js");
const index_js_1 = require("../../index.js");
const Referencer_js_1 = __importDefault(require("./Referencer.js"));
class WideColumnarColumn {
    name;
    primaryKey;
    default;
    type;
    path;
    files;
    table;
    memMap;
    #log;
    referencer;
    repairMode = false;
    constructor(options) {
        this.name = options.name;
        this.primaryKey = options.primaryKey;
        this.default = options.default;
        this.type = options.type;
        if (!this.primaryKey && this.default === undefined)
            throw new Error("Default value is required for non primary key columns");
    }
    setPath(path) {
        this.path = path;
    }
    setFiles() {
        this.files = this.#getFiles();
    }
    setTable(table) {
        this.table = table;
    }
    #getFiles() {
        return (0, fs_1.readdirSync)(this.path).filter((x) => x.endsWith(this.table.db.options.fileConfig.extension));
    }
    async initialize() {
        await this.#initalize();
        await this.#getLogInfo();
        await this.#syncWithLogs();
    }
    async #initalize() {
        this.memMap = new MemMap_js_1.default({
            limit: this.table.db.options.cacheConfig.limit,
            sortFunction: this.table.db.options.cacheConfig.sortFunction,
        }, this);
        const transactionPath = `${this.path}/transaction.wdcl`;
        const fullWriterPath = `${this.path}/fullWriter.wdcl`;
        if (!(0, fs_1.existsSync)(transactionPath)) {
            const IV = (0, crypto_1.randomBytes)(16).toString("hex");
            await (0, promises_2.writeFile)(transactionPath, IV + "\n\n");
        }
        if (!(0, fs_1.existsSync)(fullWriterPath)) {
            const IV = (0, crypto_1.randomBytes)(16).toString("hex");
            await (0, promises_2.writeFile)(fullWriterPath, IV + "\n\n");
        }
        const referencePath = `${this.table.db.options.dataConfig.path}/${this.table.db.options.dataConfig.referencePath}/${this.table.name}/${this.name}/${this.name}.wdcr`;
        if (!(0, fs_1.existsSync)(referencePath)) {
            await (0, promises_2.writeFile)(referencePath, "");
        }
        this.referencer = new Referencer_js_1.default(`${this.table.db.options.dataConfig.path}/${this.table.db.options.dataConfig.referencePath}/${this.table.name}/${this.name}`, this.table.db.options.cacheConfig.limit, this.table.db.options.cacheConfig.referenceType, this);
        this.setFiles();
    }
    async #readIvfromLog() {
        const logFile = `${this.path}/transaction.wdcl`;
        return new Promise(async (res, rej) => {
            if (!(0, fs_1.existsSync)(logFile)) {
                rej("log file not found");
            }
            else {
                let iv;
                const rs = (0, fs_1.createReadStream)(logFile, {
                    highWaterMark: 33,
                    encoding: "utf8",
                    flags: "r",
                });
                rs.on("data", async (chunk) => {
                    iv = chunk;
                    rs.close();
                })
                    .on("error", (err) => {
                    rej(err);
                })
                    .on("close", () => {
                    res(iv.trim());
                });
            }
        });
    }
    async #readIvfromFullLog() {
        const logFile = `${this.path}/fullWriter.wdcl`;
        return new Promise(async (res, rej) => {
            if (!(0, fs_1.existsSync)(logFile)) {
                rej("log file not found");
            }
            else {
                let iv;
                const rs = (0, fs_1.createReadStream)(logFile, {
                    highWaterMark: 33,
                    encoding: "utf8",
                    flags: "r",
                });
                rs.on("data", async (chunk) => {
                    iv = chunk;
                    rs.close();
                })
                    .on("error", (err) => {
                    rej(err);
                })
                    .on("close", () => {
                    res(iv.trim());
                });
            }
        });
    }
    async #getLogInfo() {
        this.#log = {
            iv: await this.#readIvfromLog(),
            path: `${this.path}/transaction.wdcl`,
            writer: (0, fs_1.createWriteStream)(`${this.path}/transaction.wdcl`, {
                flags: "a",
                encoding: "utf8",
            }),
            fullWriter: (0, fs_1.createWriteStream)(`${this.path}/fullWriter.wdcl`, {
                flags: "a",
                encoding: "utf8",
            }),
            ivFull: await this.#readIvfromFullLog(),
        };
    }
    async #syncWithLogs() {
        const logFile = this.#log.path;
        const rl = promises_3.default.createInterface({
            input: (0, fs_1.createReadStream)(logFile),
            crlfDelay: Infinity,
        });
        let index = 0;
        for await (const line of rl) {
            if (index < 2) {
                index++;
                continue;
            }
            const decrypted = (0, utils_js_1.decrypt)({
                iv: this.#log.iv,
                data: line,
            }, this.table.db.options.encryptionConfig.securityKey);
            const [columnValue, columnType, primaryValue, primaryType, method] = decrypted.split(utils_js_1.ReferenceConstantSpace);
            const parsedMethod = Number(method.trim());
            const data = new Data_js_1.default({
                column: {
                    name: this.name,
                    type: columnType,
                    value: (0, utils_js_1.parse)(columnValue, columnType),
                },
                primary: {
                    name: this.table.primary.name,
                    type: this.table.primary.type,
                    value: (0, utils_js_1.parse)(primaryValue, primaryType),
                },
            });
            if (parsedMethod === index_js_1.DatabaseMethod.Set) {
                this.memMap.set(data);
            }
            else if (parsedMethod === index_js_1.DatabaseMethod.Delete) {
                this.memMap.delete(data.primary.value);
            }
        }
    }
    async #createNewLogCycle() {
        return new Promise((res, rej) => {
            this.#log.writer.end(async () => {
                const IV = (0, crypto_1.randomBytes)(16).toString("hex");
                (0, fs_1.truncateSync)(this.#log.path);
                this.#log.iv = IV;
                await (0, promises_1.appendFile)(this.#log.path, IV + "\n\n");
                this.#log.writer = (0, fs_1.createWriteStream)(this.#log.path, {
                    flags: "a",
                    encoding: "utf8",
                });
                res();
            });
        });
    }
    async #wal(data, method) {
        return new Promise(async (res, rej) => {
            const json = data.toJSON();
            const delimitedString = (0, utils_js_1.createHashRawString)([
                (0, utils_js_1.stringify)(json.column.value),
                json.column.type,
                (0, utils_js_1.stringify)(json.primary.value),
                json.primary.type,
                method?.toString(),
            ]);
            const hash = (0, utils_js_1.createHash)(delimitedString, this.table.db.options.encryptionConfig.securityKey, this.#log.iv);
            const fullHash = (0, utils_js_1.createHash)(delimitedString, this.table.db.options.encryptionConfig.securityKey, this.#log.ivFull);
            await (0, promises_1.appendFile)(this.#log.path, hash + "\n");
            await (0, promises_1.appendFile)(`${this.path}/fullWriter.wdcl`, fullHash + "\n");
            res();
        });
    }
    async flush(data) {
        return new Promise(async (res, rej) => {
            const path = `${this.path}/${this.name}_${this.files.length}${this.table.db.options.fileConfig.extension}`;
            data = data.sort(this.table.db.options.cacheConfig.sortFunction);
            const dataToWrite = data.map((x) => {
                const encrypted = (0, utils_js_1.encrypt)(x.toString(), this.table.db.options.encryptionConfig.securityKey);
                return `${encrypted.iv}.${encrypted.data}`;
            });
            await (0, promises_2.writeFile)(path, dataToWrite.join("\n"));
            this.files.push(path);
            this.memMap.heap.clear();
            await this.#createNewLogCycle();
            res();
        });
    }
    async set(primary, value) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return;
        }
        const data = new Data_js_1.default({
            column: {
                name: this.name,
                type: this.type,
                value: value,
            },
            primary: {
                name: this.table.primary.name,
                type: this.table.primary.type,
                value: primary,
            },
        });
        await this.#wal(data, index_js_1.DatabaseMethod.Set);
        this.memMap.set(data);
    }
    async get(primary) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return null;
        }
        if (this.memMap.has(primary)) {
            return this.memMap.get(primary);
        }
        else {
            return await this.#get(primary);
        }
    }
    async #get(primary) {
        return new Promise(async (res, rej) => {
            const reference = await this.referencer.getReference();
            const file = reference[(0, utils_js_1.stringify)(primary)];
            if (file) {
                const line = await this.#fetchLine(file.file, file.index);
                if (line === null) {
                    res(null);
                    return;
                }
                const [iv, ecrypted] = line.split(".");
                const decrpyted = (0, utils_js_1.decrypt)({ data: ecrypted, iv }, this.table.db.options.encryptionConfig.securityKey);
                const json = JSON.parse(decrpyted);
                const data = new Data_js_1.default(json);
                res(data);
            }
            else {
                res(null);
            }
        });
    }
    async #fetchLine(file, index) {
        const stream = (0, fs_1.createReadStream)(file);
        const rl = promises_3.default.createInterface({
            input: stream,
            crlfDelay: Infinity,
        });
        let i = 0;
        for await (const line of rl) {
            if (i === index) {
                return line;
            }
            i++;
        }
        return null;
    }
    async has(primary) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return false;
        }
        if (this.memMap.has(primary)) {
            return true;
        }
        else {
            return await this.#has(primary);
        }
    }
    async #has(primary) {
        if (this.memMap.has(primary)) {
            return true;
        }
        const reference = await this.referencer.getReference();
        return reference[(0, utils_js_1.stringify)(primary)] !== undefined;
    }
    async delete(primary) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return;
        }
        const data = new Data_js_1.default({
            column: {
                name: this.name,
                type: this.type,
                value: this.default,
            },
            primary: {
                name: this.table.primary.name,
                type: this.table.primary.type,
                value: primary,
            },
        });
        await this.#wal(data, index_js_1.DatabaseMethod.Delete);
        if (this.memMap.has(primary)) {
            this.memMap.delete(primary);
        }
        else {
            await this.#delete(primary);
        }
    }
    async #delete(primary) {
        const reference = await this.referencer.getReference();
        const file = reference[(0, utils_js_1.stringify)(primary)];
        if (!file) {
            return;
        }
        const fileData = await this.#fetchFile(file.file);
        const filtered = fileData.filter((x) => x.primary.value !== primary);
        await this.#flushFile(file.file, filtered);
    }
    async #flushFile(file, data) {
        return new Promise(async (res, rej) => {
            const dataToWrite = data.map((x) => {
                const encrypted = (0, utils_js_1.encrypt)(x.toString(), this.table.db.options.encryptionConfig.securityKey);
                return `${encrypted.iv}.${encrypted.data}`;
            });
            await (0, promises_2.writeFile)(file, dataToWrite.join("\n"));
            res();
        });
    }
    async clear() {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return;
        }
        this.memMap = new MemMap_js_1.default({
            limit: this.table.db.options.cacheConfig.limit,
            sortFunction: this.table.db.options.cacheConfig.sortFunction,
        }, this);
        await this.referencer.clear();
        (0, fs_1.rmSync)(this.path, { recursive: true });
        await this.#initalize();
    }
    async getHeap() {
        return this.memMap.getHeap();
    }
    async findOne(query) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return null;
        }
        const data = this.memMap.findOne(query);
        if (data)
            return data;
        else
            return await this.#findOne(query);
    }
    async #fetchFile(file) {
        const stream = (0, fs_1.createReadStream)(file);
        const rl = promises_3.default.createInterface({
            input: stream,
            crlfDelay: Infinity,
        });
        const data = [];
        for await (const line of rl) {
            const [iv, ecrypted] = line.split(".");
            const decrpyted = (0, utils_js_1.decrypt)({ data: ecrypted, iv }, this.table.db.options.encryptionConfig.securityKey);
            const json = JSON.parse(decrpyted);
            const d = new Data_js_1.default(json);
            data.push(d);
        }
        return data;
    }
    async #findOne(query) {
        const files = this.files;
        for (const file of files) {
            const stream = (0, fs_1.createReadStream)(`${this.path}/${file}`);
            const rl = promises_3.default.createInterface({
                input: stream,
                crlfDelay: Infinity,
            });
            let i = 0;
            for await (const line of rl) {
                const [iv, ecrypted] = line.split(".");
                const decrpyted = (0, utils_js_1.decrypt)({ data: ecrypted, iv }, this.table.db.options.encryptionConfig.securityKey);
                const json = JSON.parse(decrpyted);
                const data = new Data_js_1.default(json);
                if (query(data)) {
                    return data;
                }
            }
        }
        return null;
    }
    async findMany(query) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return [];
        }
        const cacheData = this.memMap.findMany(query).V();
        const filesData = await this.#findMany(query);
        const datas = [...cacheData, ...filesData].sort(this.table.db.options.cacheConfig.sortFunction);
        return datas;
    }
    async #findMany(query) {
        const files = this.files;
        const data = [];
        for (const file of files) {
            const fileData = await this.#fetchFile(`${this.path}/${file}`);
            data.push(...fileData.filter(query));
        }
        return data;
    }
    async deleteMany(query) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return;
        }
        const data = await this.findMany(query);
        await this.#bulkDelete(data);
    }
    async #bulkDelete(data) {
        const queue = {};
        const reference = await this.referencer.getReference();
        for (const d of data) {
            if (this.memMap.has(d.primary.value)) {
                this.memMap.delete(d.primary.value);
            }
            else {
                const file = reference[(0, utils_js_1.stringify)(d.primary.value)];
                if (!file) {
                    continue;
                }
                if (!queue[file.file]) {
                    queue[file.file] = [];
                }
                queue[file.file].push(d);
            }
        }
        const promises = [];
        for (const file in queue) {
            const promise = new Promise(async (res, rej) => {
                const fileData = await this.#fetchFile(file);
                const filtered = fileData.filter((x) => !queue[file].some((y) => y.primary.value === x.primary.value));
                await this.#flushFile(file, filtered);
                res();
            });
            promises.push(promise);
        }
        await Promise.all(promises);
    }
    async all(query, limit) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return [];
        }
        const data = await this.findMany(query);
        data.sort(this.table.db.options.cacheConfig.sortFunction);
        return data.slice(0, limit);
    }
    async fullRepair() {
        this.repairMode = true;
        const transactionPath = this.#log.path;
        const fullWriterPath = `${this.path}/fullWriter.wdcl`;
        await (0, promises_1.truncate)(transactionPath);
        const rl = promises_3.default.createInterface({
            input: (0, fs_1.createReadStream)(fullWriterPath),
            crlfDelay: Infinity,
        });
        let index = 0;
        const datas = [];
        for await (const line of rl) {
            if (index < 2) {
                index++;
                continue;
            }
            const decrypted = (0, utils_js_1.decrypt)({
                iv: this.#log.ivFull,
                data: line,
            }, this.table.db.options.encryptionConfig.securityKey);
            const [columnValue, columnType, primaryValue, primaryType, method] = decrypted.split(utils_js_1.ReferenceConstantSpace);
            const parsedMethod = Number(method.trim());
            const data = new Data_js_1.default({
                column: {
                    name: this.name,
                    type: columnType,
                    value: (0, utils_js_1.parse)(columnValue, columnType),
                },
                primary: {
                    name: this.table.primary.name,
                    type: this.table.primary.type,
                    value: (0, utils_js_1.parse)(primaryValue, primaryType),
                },
            });
            if (this.memMap.has(data.primary.value)) {
                continue;
            }
            if (parsedMethod === index_js_1.DatabaseMethod.Set) {
                datas.push(data);
            }
            else if (parsedMethod === index_js_1.DatabaseMethod.Delete) {
                const index = datas.findIndex((x) => x.primary.value === data.primary.value);
                if (index !== -1) {
                    datas.splice(index, 1);
                }
            }
        }
        // delete all files
        for (const file of this.files) {
            await (0, promises_1.unlink)(`${this.path}/${file}`);
        }
        this.files = [];
        // divide the datas into chunks
        const chunks = [];
        let i = 0;
        let j = datas.length;
        while (i < j) {
            let bufferSize = "";
            while (bufferSize.length < this.table.db.options.cacheConfig.limit) {
                const encrypted = (0, utils_js_1.encrypt)(datas[i].toString(), this.table.db.options.encryptionConfig.securityKey);
                bufferSize += `${encrypted.iv}.${encrypted.data}\n`;
                i++;
            }
            chunks.push(bufferSize);
        }
        // write the chunks to files
        const promises = [];
        for (const chunk of chunks) {
            const promise = new Promise(async (res, rej) => {
                const path = `${this.path}/${this.name}_${this.files.length}${this.table.db.options.fileConfig.extension}`;
                await (0, promises_2.writeFile)(path, chunk);
                this.files.push(path);
                res();
            });
        }
        await Promise.all(promises);
        // clear the logs
        await this.#createNewLogCycle();
    }
}
exports.default = WideColumnarColumn;
//# sourceMappingURL=Column.js.map