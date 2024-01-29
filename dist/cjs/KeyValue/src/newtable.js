"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const newcache_js_1 = __importDefault(require("./newcache.js"));
const fs_1 = require("fs");
const utils_js_1 = require("../../utils.js");
const index_js_1 = require("../../index.js");
const promises_1 = require("fs/promises");
const referencer_js_1 = __importDefault(require("../../global/referencer.js"));
const queue_js_1 = __importDefault(require("./queue.js"));
const data_js_1 = __importDefault(require("./data.js"));
const promises_2 = require("timers/promises");
const crypto_1 = require("crypto");
const promises_3 = require("readline/promises");
const structures_1 = require("@akarui/structures");
class Table extends events_1.default {
    #options;
    #db;
    #cache;
    locked = false;
    isFlushing = false;
    repairMode = false;
    files;
    paths;
    logData;
    referencer;
    #queue;
    #flushInterval;
    readyAt = -1;
    constructor(options, db) {
        super();
        this.#options = options;
        this.#db = db;
        this.#cache = new newcache_js_1.default(this.#db.options.cacheConfig);
        this.#queue = new queue_js_1.default();
    }
    get options() {
        return this.#options;
    }
    async initialize() {
        this.#getPaths();
        await this.#setReference();
        this.#getFiles();
        await this.#getLogData();
        await this.#checkIntegrity();
        await this.#syncWithLog();
        await this.#syncReferencer();
        this.#enableIntervals();
        this.readyAt = Date.now();
        this.#db.emit(index_js_1.DatabaseEvents.TableReady, this);
    }
    #enableIntervals() {
        if (this.locked)
            return;
        this.#flushInterval = setInterval(async () => {
            // console.log({ isf: this.isFlushing });
            if (this.isFlushing)
                return;
            this.isFlushing = true;
            await this.#flush();
        }, 500);
    }
    async #setReference() {
        this.referencer = new referencer_js_1.default(this.paths.reference, this.#db.options.fileConfig.maxSize, this.#db.options.cacheConfig.reference);
        await this.referencer.initialize();
    }
    #getPaths() {
        const { path, referencePath } = this.#db.options.dataConfig;
        const transactionLogPath = this.#db.options.fileConfig.transactionLogPath;
        const { name } = this.#options;
        this.paths = {
            reference: `${referencePath}/${name}`,
            log: `${transactionLogPath}/${name}/transaction.log`,
            table: `${path}/${name}`,
            fullWriter: `${transactionLogPath}/${name}/fullWriter.log`,
        };
    }
    #getFiles() {
        this.files = (0, fs_1.readdirSync)(this.paths.table).map((file) => {
            const size = (0, fs_1.statSync)(`${this.paths.table}/${file}`).size;
            return {
                name: file,
                size,
                isInWriteMode: false,
            };
        });
    }
    async #getLogData() {
        this.logData = {
            writer: (0, fs_1.createWriteStream)(this.paths.log, {
                flags: "a",
            }),
            size: (0, fs_1.statSync)(this.paths.log).size,
            fullWriter: (0, fs_1.createWriteStream)(this.paths.fullWriter, {
                flags: "a",
            }),
            logIV: await this.#getLogIV(this.paths.log),
        };
    }
    async #getLogIV(path) {
        return new Promise((resolve, reject) => {
            const stream = (0, fs_1.createReadStream)(path);
            let hash = "";
            stream.on("readable", () => {
                hash = stream.read(32);
                stream.close();
            });
            stream.on("close", () => resolve(hash.toString()));
            stream.on("error", reject);
        });
    }
    async #checkIntegrity() {
        const files = [...this.files];
        let index = 0;
        for (const fileObj of files) {
            if (fileObj.name.startsWith("$temp_")) {
                (0, fs_1.unlinkSync)(`${this.paths.table}/${fileObj.name}`);
                this.files.splice(index, 1);
                continue;
            }
            const data = (0, fs_1.readFileSync)(`${this.paths.table}/${fileObj.name}`, "utf-8").trim();
            const { data: json, isBroken } = (0, utils_js_1.JSONParser)(data);
            if (isBroken) {
                if (!Object.keys(json).length) {
                    console.warn(`File ${fileObj.name} in table ${this.#options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data. from logs`);
                    this.locked = true;
                    return;
                }
                console.warn(`
Attempting to repair file ${fileObj.name} in table ${this.#options.name}. Data found: ${Object.keys(json).length}. Please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data if the data is not correct. `);
                this.repairMode = true;
                const { securityKey, encriptData } = this.#db.options.encryptionConfig;
                let dataToWrite;
                if (encriptData) {
                    const decrypted = (0, utils_js_1.decrypt)(json, securityKey);
                    const { data: parsed, isBroken } = (0, utils_js_1.JSONParser)(decrypted);
                    if (isBroken) {
                        console.warn(`File ${fileObj.name} in table ${this.#options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data. from logs`);
                        this.locked = true;
                        return;
                    }
                    else {
                        dataToWrite = JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(parsed), securityKey));
                    }
                }
                else {
                    dataToWrite = JSON.stringify(json);
                }
                (0, fs_1.writeFileSync)(`${this.paths.table}/${fileObj.name}`, dataToWrite);
            }
        }
        index++;
    }
    async #syncWithLog() {
        if (this.locked)
            return;
        const logBlocks = await this.getLogs();
        const reference = await this.referencer.getReference();
        const lastFlushIndex = logBlocks.findLastIndex((block) => block.method === index_js_1.DatabaseMethod.Flush);
        const startIndex = lastFlushIndex === -1 ? 0 : lastFlushIndex + 1;
        for (let index = startIndex; index < logBlocks.length; index++) {
            const { key, value, type, method } = logBlocks[index];
            if (method === index_js_1.DatabaseMethod.Set) {
                let file;
                if (reference[key])
                    file = reference[key]?.file;
                else
                    file = await this.#fileToPlace(new data_js_1.default({ key, value, type, file: "" }));
                const data = new data_js_1.default({
                    file,
                    key,
                    value,
                    type,
                });
                if (!file)
                    file = await this.#fileToPlace(data);
                data.file = file;
                this.#queue.add(data);
                this.#cache.set(data.key, data);
            }
            if (method === index_js_1.DatabaseMethod.Delete) {
                if (!reference[key]) {
                    if (this.#cache.has(key)) {
                        this.#queue.add({
                            key,
                            file: this.#cache.get(key)?.file || "",
                        });
                        this.#cache.delete(key);
                        continue;
                    }
                }
                if (!reference[key]?.file)
                    continue;
                this.#queue.add({ key, file: reference[key].file });
                this.#cache.delete(key);
            }
        }
        await this.#initFlush();
        this.#queue.clear("set");
        this.#queue.clear("delete");
    }
    async #syncReferencer() {
        this.referencer.sync(this.files.map((file) => file.name), this);
    }
    async fetchFile(path) {
        const { securityKey, encriptData } = this.#db.options.encryptionConfig;
        const fileName = path.split("/").at(-1);
        const fileObj = this.files.find((fileObj) => fileObj.name === fileName);
        if (!fileObj)
            return undefined;
        if (fileObj.size <= 2)
            return {};
        if (fileObj.isInWriteMode) {
            await (0, promises_2.setTimeout)(100);
            return this.fetchFile(path);
        }
        const dataString = await (0, promises_1.readFile)(path, "utf-8");
        const { data: json, isBroken } = (0, utils_js_1.JSONParser)(dataString);
        if (isBroken && !Object.keys(json).length) {
            console.warn(`File ${path} in table ${this.#options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data. from logs`);
            this.locked = true;
            return;
        }
        if (encriptData) {
            const decrypted = (0, utils_js_1.decrypt)(json, securityKey);
            const { data: parsed, isBroken } = (0, utils_js_1.JSONParser)(decrypted);
            if (isBroken) {
                console.warn(`File ${path} in table ${this.#options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data. from logs`);
                this.locked = true;
                return;
            }
            else {
                return parsed;
            }
        }
        else {
            return json;
        }
    }
    async getLogs() {
        if (this.locked) {
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data. from logs");
        }
        const { securityKey } = this.#db.options.encryptionConfig;
        const blocks = [];
        const rl = (0, promises_3.createInterface)({
            input: (0, fs_1.createReadStream)(this.paths.log),
            crlfDelay: Infinity,
        });
        for await (const logLine of rl) {
            const [key, value, type, ttl, // ttl for old versions backwards compatibility
            method,] = (0, utils_js_1.decodeHash)(logLine, securityKey, this.logData.logIV);
            let parsedMethod;
            if (!method)
                parsedMethod = Number(ttl);
            else
                parsedMethod = Number(method);
            blocks.push({
                key,
                value,
                type: type,
                method: parsedMethod,
            });
        }
        return blocks;
    }
    async #fileToPlace(data) {
        const currentFile = this.files.at(-1);
        const { maxSize } = this.#db.options.fileConfig;
        const fileSize = currentFile.size;
        const setQueue = this.#queue.get("set");
        const size = setQueue[data.file] || 0;
        if (fileSize + size + data.size > maxSize) {
            const newFile = await this.#createFile();
            return newFile.name;
        }
        else {
            return currentFile.name;
        }
    }
    async #createFile(log = true) {
        const { extension } = this.#db.options.fileConfig;
        const name = `${this.files.length}.${extension}`;
        const path = `${this.paths.table}/${name}`;
        await (0, promises_1.writeFile)(path, "{}");
        const fileObj = {
            name,
            size: 2,
            isInWriteMode: false,
        };
        this.files.push(fileObj);
        if (log)
            await this.#wal(data_js_1.default.emptyData(), index_js_1.DatabaseMethod.NewFile);
        return fileObj;
    }
    async #initFlush() {
        const setData = this.#queue.get("set");
        const deleteData = this.#queue.get("delete");
        const reference = await this.referencer.getReference();
        const files = new Set();
        for (const data of setData.data) {
            files.add(data.file);
        }
        for (const { key } of deleteData.data) {
            if (!reference[key])
                continue;
            files.add(reference[key].file);
        }
        for (const file of files) {
            const data = await this.fetchFile(`${this.paths.table}/${file}`);
            if (!data)
                continue;
            for (const dataToAdd of setData.data) {
                if (dataToAdd.file !== file)
                    continue;
                data[dataToAdd.key] = dataToAdd.toJSON();
            }
            for (const { key } of deleteData.data) {
                if (!data[key])
                    continue;
                delete data[key];
            }
            const { securityKey, encriptData } = this.#db.options.encryptionConfig;
            let dataToWrite;
            if (encriptData) {
                dataToWrite = JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(data), securityKey));
            }
            else {
                dataToWrite = JSON.stringify(data);
            }
            await (0, promises_1.writeFile)(`${this.paths.table}/${file}`, dataToWrite);
        }
    }
    async #wal(data, method) {
        return new Promise(async (resolve, reject) => {
            const { key, type, value } = data.toJSON();
            const { securityKey } = this.#db.options.encryptionConfig;
            const delimitedString = (0, utils_js_1.createHashRawString)([
                key,
                (0, utils_js_1.stringify)(value),
                type,
                method.toString(),
            ]);
            const logHash = (0, utils_js_1.createHash)(delimitedString, securityKey, this.logData.logIV);
            this.logData.writer.write(`${logHash}\n`, (logError) => {
                if (logError) {
                    reject(logError);
                    return;
                }
                this.logData.size += logHash.length + 1;
                this.logData.fullWriter.write(`${delimitedString}\n`, async (fullWriterError) => {
                    if (fullWriterError) {
                        reject(fullWriterError);
                        return;
                    }
                    if (method === index_js_1.DatabaseMethod.Flush) {
                        if (this.logData.size > this.#db.options.fileConfig.maxSize) {
                            await (0, promises_1.truncate)(this.paths.log, 33);
                        }
                    }
                    resolve();
                    return;
                });
            });
        });
    }
    async set(key, dataObj) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        const reference = await this.referencer.getReference();
        let data;
        const { value, type } = dataObj;
        if (reference[key]) {
            data = new data_js_1.default({
                key,
                value: value,
                type: type,
                file: reference[key].file,
            });
        }
        else {
            data = new data_js_1.default({
                key,
                value: value,
                type: type,
                file: "",
            });
            const file = await this.#fileToPlace(data);
            data.file = file;
        }
        this.#cache.set(key, data);
        await this.#wal(data, index_js_1.DatabaseMethod.Set);
        await this.referencer.setReference(key, data.file);
        this.#queue.add(data);
    }
    async #flush() {
        // console.log({ isFlushing: this.isFlushing });
        if (this.locked)
            return;
        // if (this.isFlushing) return;
        if (this.repairMode)
            return;
        if (!this.#queue.getQueueSize("set") &&
            !this.#queue.getQueueSize("delete")) {
            this.isFlushing = false;
            return;
        }
        // this.isFlushing = true;
        const filesToWrite = new Set();
        const QueueData = [];
        for (const data of this.#queue.get("set").data) {
            QueueData.push(data);
        }
        const DeleteQueue = [];
        for (const data of this.#queue.get("delete").data) {
            DeleteQueue.push(data);
        }
        for (const data of QueueData) {
            filesToWrite.add(data.file);
        }
        for (const { file } of DeleteQueue) {
            filesToWrite.add(file);
        }
        const promises = [];
        for (const file of filesToWrite) {
            const promise = new Promise(async (resolve, reject) => {
                const fileObj = this.files.find((fileObj) => fileObj.name === file);
                // console.log({ fileObj });
                if (!fileObj) {
                    reject(0);
                    return;
                }
                if (fileObj.isInWriteMode) {
                    reject(1);
                    return;
                }
                let fileData = await this.fetchFile(`${this.paths.table}/${file}`);
                fileObj.isInWriteMode = true;
                if (!fileData) {
                    fileData = {};
                }
                // console.log(fileData);
                // console.log({ QueueData, DeleteQueue });
                for (const data of QueueData) {
                    this.#queue.remove("set", data.key);
                    // console.log({ data, file });
                    if (data.file !== file)
                        continue;
                    fileData[data.key] = data.toJSON();
                }
                for (const { key } of DeleteQueue) {
                    this.#queue.remove("delete", key);
                    if (!fileData[key])
                        continue;
                    delete fileData[key];
                }
                const { securityKey, encriptData } = this.#db.options.encryptionConfig;
                let dataToWrite;
                if (encriptData) {
                    dataToWrite = JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(fileData), securityKey));
                }
                else {
                    dataToWrite = JSON.stringify(fileData);
                }
                // console.log(dataToWrite);
                const path = `${this.paths.table}/$temp_${file}`;
                (0, promises_1.writeFile)(path, dataToWrite).then(() => {
                    // console.log(existsSync(path));
                    (0, promises_1.rename)(path, `${this.paths.table}/${file}`).then(() => {
                        // console.log(existsSync(path));
                        this.#wal(data_js_1.default.emptyData(), index_js_1.DatabaseMethod.Flush).then(() => {
                            fileObj.size = (0, fs_1.statSync)(`${this.paths.table}/${file}`).size;
                            fileObj.isInWriteMode = false;
                            resolve();
                        });
                    });
                });
                // resolve();
            });
            promises.push(promise);
        }
        await Promise.all(promises)
            .then(() => {
            this.isFlushing = false;
        })
            .catch((e) => {
            // console.log(e);
            if (e === 0)
                this.isFlushing = false;
        });
    }
    async get(key) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        const data = this.#cache.get(key);
        if (data)
            return data;
        else {
            const reference = await this.referencer.getReference();
            if (!reference[key])
                return null;
            const file = reference[key].file;
            const data = await this.fetchFile(`${this.paths.table}/${file}`);
            if (!data || !Object.keys(data).length)
                return null;
            this.#cache.bulkFileSet(data, file);
            if (!data[key])
                return null;
            const getData = new data_js_1.default({
                file,
                key,
                value: data[key].value,
                type: data[key].type,
            });
            return getData;
        }
    }
    async has(key) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        if (this.#cache.has(key))
            return true;
        const reference = await this.referencer.getReference();
        return !!reference[key];
    }
    async delete(key) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        if (this.#cache.has(key)) {
            const data = this.#cache.get(key);
            if (!data)
                return;
            this.#cache.delete(key);
            await this.#wal(data, index_js_1.DatabaseMethod.Delete);
            await this.referencer.deleteReference(key);
            this.#queue.add({ key, file: data.file });
        }
        else {
            const reference = await this.referencer.getReference();
            if (!reference[key])
                return;
            const file = reference[key].file;
            const emptyData = data_js_1.default.emptyData();
            emptyData.key = key;
            emptyData.file = file;
            await this.#wal(emptyData, index_js_1.DatabaseMethod.Delete);
            await this.referencer.deleteReference(key);
            this.#queue.add({ key, file });
        }
    }
    async clear() {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        this.#cache.clear();
        this.#queue.clear("set");
        this.#queue.clear("delete");
        this.files = [];
        await this.#createFile(false);
        await this.referencer.clear();
        await this.#reset();
    }
    async #reset() {
        return new Promise(async (resolve, reject) => {
            this.logData.writer.close();
            await (0, promises_1.truncate)(this.paths.log, 0);
            this.logData.size = 0;
            this.logData.writer = (0, fs_1.createWriteStream)(this.paths.log, {
                flags: "a",
            });
            const iv = (0, crypto_1.randomBytes)(16).toString("hex");
            this.logData.logIV = iv;
            this.logData.writer.write(iv + "\n\n", (err) => {
                if (err)
                    reject(err);
                resolve();
            });
        });
    }
    async all(query, limit, order) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        if (order === "firstN")
            return this.getFirstN(query, limit);
        let matchedData = await this.findMany(query);
        if (order === "asc") {
            matchedData = matchedData.sort((a, b) => this.#db.options.cacheConfig.sortFunction(a, b));
            return matchedData.slice(0, limit);
        }
        else {
            matchedData = matchedData.sort((a, b) => this.#db.options.cacheConfig.sortFunction(b, a));
            return matchedData.slice(0, limit);
        }
    }
    async findOne(query) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        const cacheData = this.#cache.find(query);
        if (cacheData)
            return cacheData;
        for (const file of this.files) {
            const data = await this.fetchFile(`${this.paths.table}/${file.name}`);
            if (!data)
                continue;
            for (const key in data) {
                const dataObj = new data_js_1.default({
                    key,
                    file: file.name,
                    value: data[key].value,
                    type: data[key].type,
                });
                if (query(dataObj))
                    return dataObj;
            }
        }
        return null;
    }
    async findMany(query) {
        const matchedCacheData = this.#cache.filter((data) => query(data));
        const res = await this.#findMany(query, matchedCacheData);
        return res;
    }
    async #findMany(query, grp) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        for (const file of this.files) {
            const data = await this.fetchFile(`${this.paths.table}/${file.name}`);
            if (!data)
                continue;
            for (const key in data) {
                const dataObj = new data_js_1.default({
                    key,
                    file: file.name,
                    value: data[key].value,
                    type: data[key].type,
                });
                if (query(dataObj) && !grp.has(dataObj.key))
                    grp.set(dataObj.key, dataObj);
            }
        }
        const array = grp.V();
        return array;
    }
    async getFirstN(query, limit) {
        if (this.locked)
            throw new Error("Table is locked. please use the <KeyValue>.fullRepair() to restore the data.");
        const cacheData = this.#cache.filter(query).top(limit);
        let data;
        if (cacheData instanceof data_js_1.default)
            data = [cacheData];
        else if (Array.isArray(cacheData))
            data = cacheData;
        else
            data = [];
        if (data.length >= limit)
            return data.slice(0, limit);
        for (const fileObj of this.files) {
            const fileData = await this.fetchFile(`${this.paths.table}/${fileObj.name}`);
            if (!fileData)
                continue;
            for (const key in fileData) {
                const dataObj = new data_js_1.default({
                    key,
                    file: fileObj.name,
                    value: fileData[key].value,
                    type: fileData[key].type,
                });
                if (query(dataObj)) {
                    data.push(dataObj);
                    if (data.length === limit)
                        return data;
                }
            }
        }
        return data;
    }
    async deleteMany(query) {
        const matchedData = await this.findMany(query);
        for (const data of matchedData) {
            await this.delete(data.key);
        }
    }
    async add(key, value) {
        const data = await this.get(key);
        if (!data)
            await this.set(key, value);
        else {
            switch (data.type) {
                case "bigint": {
                    data.value += value.value;
                    break;
                }
                case "number": {
                    data.value += value.value;
                    break;
                }
                case "string": {
                    data.value += value.value;
                    break;
                }
                case "date": {
                    data.value = new Date(data.value).setMilliseconds(value.value);
                    break;
                }
                case "object": {
                    if (Array.isArray(data.value)) {
                        data.value.push(...value.value);
                    }
                    else {
                        data.value = {
                            ...data.value,
                            ...value.value,
                        };
                    }
                    break;
                }
                default: {
                    throw new Error("Cannot add to this data type");
                }
            }
            await this.set(key, data.toJSON());
        }
    }
    async subtract(key, value) {
        const data = await this.get(key);
        if (!data)
            await this.set(key, value);
        else {
            switch (data.type) {
                case "bigint": {
                    data.value -= value.value;
                    break;
                }
                case "number": {
                    data.value -= value.value;
                    break;
                }
                case "string": {
                    data.value = data.value.replace(value.value, "");
                    break;
                }
                case "date": {
                    data.value = new Date(data.value).setMilliseconds(-value.value);
                    break;
                }
                case "object": {
                    if (Array.isArray(data.value)) {
                        data.value = data.value.filter((v) => !value.value.includes(v));
                    }
                    else {
                        const obj = data.value;
                        for (const key in value.value) {
                            delete obj[key];
                        }
                        data.value = obj;
                    }
                    break;
                }
                default: {
                    throw new Error("Cannot subtract to this data type");
                }
            }
            await this.set(key, data.toJSON());
        }
    }
    async ping() {
        const startTime = performance.now();
        await this.findOne(() => true);
        const endTime = performance.now();
        return endTime - startTime;
    }
    async fullRepair() {
        this.repairMode = true;
        await this.clear();
        clearInterval(this.#flushInterval);
        this.locked = true;
        const rl = (0, promises_3.createInterface)({
            input: (0, fs_1.createReadStream)(this.paths.fullWriter),
            crlfDelay: Infinity,
        });
        const dataToAdd = new structures_1.Group(Infinity);
        for await (const logLine of rl) {
            const [key, value, type, ttl, // ttl for old versions backwards compatibility
            method,] = logLine.split(utils_js_1.ReferenceConstantSpace);
            let parsedMethod;
            if (!method)
                parsedMethod = Number(ttl);
            else
                parsedMethod = Number(method);
            if (parsedMethod === index_js_1.DatabaseMethod.Set) {
                const data = new data_js_1.default({
                    key,
                    value,
                    type: type,
                    file: "",
                });
                const file = this.files.at(-1)?.name;
                data.file = file;
                dataToAdd.set(data.key, data);
                this.#cache.set(data.key, data);
            }
            if (parsedMethod === index_js_1.DatabaseMethod.Delete) {
                this.#cache.delete(key);
                dataToAdd.delete(key);
            }
            if (parsedMethod === index_js_1.DatabaseMethod.NewFile) {
                await this.#createFile(false);
            }
        }
        const files = new Set();
        const dataArray = dataToAdd.V();
        for (const data of dataArray) {
            files.add(data.file);
        }
        const promises = [];
        for (const file of files) {
            const promise = new Promise(async (resolve, reject) => {
                const path = `${this.paths.table}/${file}`;
                let dataToWrite;
                const filteredData = dataArray.filter((data) => data.file === file);
                const { securityKey, encriptData } = this.#db.options.encryptionConfig;
                if (encriptData) {
                    const dataObj = {};
                    for (const data of filteredData) {
                        dataObj[data.key] = data.toJSON();
                    }
                    dataToWrite = JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(dataObj), securityKey));
                }
                else {
                    const dataObj = {};
                    for (const data of filteredData) {
                        dataObj[data.key] = data.toJSON();
                    }
                    dataToWrite = JSON.stringify(dataObj);
                }
                await (0, promises_1.writeFile)(path, dataToWrite);
            });
            promises.push(promise);
        }
        await Promise.all(promises);
        this.repairMode = false;
        this.locked = false;
    }
    get cache() {
        return this.#cache;
    }
}
exports.default = Table;
//# sourceMappingURL=newtable.js.map