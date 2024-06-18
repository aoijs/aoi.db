// @ts-nocheck
import EventEmitter from "events";
import Cacher from "./newcache.js";
import { createReadStream, createWriteStream, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, } from "fs";
import { JSONParser, ReferenceConstantSpace, createHash, createHashRawString, decodeHash, decrypt, encrypt, stringify, } from "../../utils.js";
import { DatabaseEvents, DatabaseMethod } from "../../index.js";
import { readFile, rename, truncate, writeFile } from "fs/promises";
import QueueManager from "./queue.js";
import Data from "./data.js";
import { setTimeout as wait } from "timers/promises";
import { randomBytes } from "crypto";
import { createInterface } from "readline/promises";
import { Group } from "@aoijs/aoi.structures";
import HashManager from "./FileManager.js";
export default class Table extends EventEmitter {
    #options;
    #db;
    #cache;
    locked = false;
    isFlushing = false;
    repairMode = false;
    files;
    paths;
    logData;
    #queue;
    #flushInterval;
    readyAt = -1;
    hashManager;
    referencer;
    constructor(options, db) {
        super();
        this.#options = options;
        this.#db = db;
        this.#cache = new Cacher(this.#db.options.cacheConfig);
        this.#queue = new QueueManager();
    }
    get options() {
        return this.#options;
    }
    get db() {
        return this.#db;
    }
    async initialize() {
        this.#getPaths();
        this.#getFiles();
        await this.#getLogData();
        await this.#checkIntegrity();
        await this.#syncWithLog();
        this.hashManager = new HashManager(10000, 20, this);
        // await this.#syncReferencer();
        this.#enableIntervals();
        this.readyAt = Date.now();
        this.#db.emit(DatabaseEvents.TableReady, this);
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
        this.files = readdirSync(this.paths.table).map((file) => {
            const size = statSync(`${this.paths.table}/${file}`).size;
            return {
                name: file,
                size,
                isInWriteMode: false,
            };
        });
    }
    async #getLogData() {
        this.logData = {
            writer: createWriteStream(this.paths.log, {
                flags: "a",
            }),
            size: statSync(this.paths.log).size,
            fullWriter: createWriteStream(this.paths.fullWriter, {
                flags: "a",
            }),
            logIV: await this.#getLogIV(this.paths.log),
        };
    }
    async #getLogIV(path) {
        return new Promise((resolve, reject) => {
            const stream = createReadStream(path);
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
                unlinkSync(`${this.paths.table}/${fileObj.name}`);
                this.files.splice(index, 1);
                continue;
            }
            const data = readFileSync(`${this.paths.table}/${fileObj.name}`, "utf-8").trim();
            const { data: json, isBroken } = JSONParser(data);
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
                    const decrypted = decrypt(json, securityKey);
                    const { data: parsed, isBroken } = JSONParser(decrypted);
                    if (isBroken) {
                        console.warn(`File ${fileObj.name} in table ${this.#options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data. from logs`);
                        this.locked = true;
                        return;
                    }
                    else {
                        dataToWrite = JSON.stringify(encrypt(JSON.stringify(parsed), securityKey));
                    }
                }
                else {
                    dataToWrite = JSON.stringify(json);
                }
                writeFileSync(`${this.paths.table}/${fileObj.name}`, dataToWrite);
            }
        }
        index++;
    }
    async #syncWithLog() {
        if (this.locked)
            return;
        const logBlocks = await this.getLogs();
        const lastFlushIndex = logBlocks.findLastIndex((block) => block.method === DatabaseMethod.Flush);
        const startIndex = lastFlushIndex === -1 ? 0 : lastFlushIndex + 1;
        for (let index = startIndex; index < logBlocks.length; index++) {
            const { key, value, type, method } = logBlocks[index];
            if (method === DatabaseMethod.Set) {
                let file;
                const data = new Data({
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
            if (method === DatabaseMethod.Delete) {
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
            await wait(100);
            return this.fetchFile(path);
        }
        const dataString = await readFile(path, "utf-8");
        const { data: json, isBroken } = JSONParser(dataString);
        if (isBroken && !Object.keys(json).length) {
            console.warn(`File ${path} in table ${this.#options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${this.#options.name}") to restore the data. from logs`);
            this.locked = true;
            return;
        }
        if (encriptData) {
            const decrypted = decrypt(json, securityKey);
            const { data: parsed, isBroken } = JSONParser(decrypted);
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
        const rl = createInterface({
            input: createReadStream(this.paths.log),
            crlfDelay: Infinity,
        });
        for await (const logLine of rl) {
            const [key, value, type, ttl, // ttl for old versions backwards compatibility
            method,] = decodeHash(logLine, securityKey, this.logData.logIV);
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
        await writeFile(path, "{}");
        const fileObj = {
            name,
            size: 2,
            isInWriteMode: false,
        };
        this.files.push(fileObj);
        if (log)
            await this.#wal(Data.emptyData(), DatabaseMethod.NewFile);
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
                dataToWrite = JSON.stringify(encrypt(JSON.stringify(data), securityKey));
            }
            else {
                dataToWrite = JSON.stringify(data);
            }
            await writeFile(`${this.paths.table}/${file}`, dataToWrite);
        }
    }
    async #wal(data, method) {
        return new Promise(async (resolve, reject) => {
            const { key, type, value } = data.toJSON();
            const { securityKey } = this.#db.options.encryptionConfig;
            const delimitedString = createHashRawString([
                key,
                stringify(value),
                type,
                method.toString(),
            ]);
            const logHash = createHash(delimitedString, securityKey, this.logData.logIV);
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
                    if (method === DatabaseMethod.Flush) {
                        if (this.logData.size > this.#db.options.fileConfig.maxSize) {
                            await truncate(this.paths.log, 33);
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
            data = new Data({
                key,
                value: value,
                type: type,
                file: reference[key].file,
            });
        }
        else {
            data = new Data({
                key,
                value: value,
                type: type,
                file: "",
            });
            const file = await this.#fileToPlace(data);
            data.file = file;
        }
        this.#cache.set(key, data);
        await this.#wal(data, DatabaseMethod.Set);
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
                    dataToWrite = JSON.stringify(encrypt(JSON.stringify(fileData), securityKey));
                }
                else {
                    dataToWrite = JSON.stringify(fileData);
                }
                // console.log(dataToWrite);
                const path = `${this.paths.table}/$temp_${file}`;
                writeFile(path, dataToWrite).then(() => {
                    // console.log(existsSync(path));
                    rename(path, `${this.paths.table}/${file}`).then(() => {
                        // console.log(existsSync(path));
                        this.#wal(Data.emptyData(), DatabaseMethod.Flush).then(() => {
                            fileObj.size = statSync(`${this.paths.table}/${file}`).size;
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
            const getData = new Data({
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
            await this.#wal(data, DatabaseMethod.Delete);
            this.#queue.add({ key, file: data.file });
        }
        else {
            const file = '';
            const emptyData = Data.emptyData();
            emptyData.key = key;
            emptyData.file = file;
            await this.#wal(emptyData, DatabaseMethod.Delete);
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
        await this.#reset();
    }
    async #reset() {
        return new Promise(async (resolve, reject) => {
            this.logData.writer.close();
            await truncate(this.paths.log, 0);
            this.logData.size = 0;
            this.logData.writer = createWriteStream(this.paths.log, {
                flags: "a",
            });
            const iv = randomBytes(16).toString("hex");
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
                const dataObj = new Data({
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
                const dataObj = new Data({
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
        if (cacheData instanceof Data)
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
                const dataObj = new Data({
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
        const rl = createInterface({
            input: createReadStream(this.paths.fullWriter),
            crlfDelay: Infinity,
        });
        const dataToAdd = new Group(Infinity);
        for await (const logLine of rl) {
            const [key, value, type, ttl, // ttl for old versions backwards compatibility
            method,] = logLine.split(ReferenceConstantSpace);
            let parsedMethod;
            if (!method)
                parsedMethod = Number(ttl);
            else
                parsedMethod = Number(method);
            if (parsedMethod === DatabaseMethod.Set) {
                const data = new Data({
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
            if (parsedMethod === DatabaseMethod.Delete) {
                this.#cache.delete(key);
                dataToAdd.delete(key);
            }
            if (parsedMethod === DatabaseMethod.NewFile) {
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
                    dataToWrite = JSON.stringify(encrypt(JSON.stringify(dataObj), securityKey));
                }
                else {
                    const dataObj = {};
                    for (const data of filteredData) {
                        dataObj[data.key] = data.toJSON();
                    }
                    dataToWrite = JSON.stringify(dataObj);
                }
                await writeFile(path, dataToWrite);
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
//# sourceMappingURL=newtable.js.map