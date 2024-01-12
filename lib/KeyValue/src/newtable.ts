import EventEmitter from "events";
import {
    KeyValue,
    KeyValueDataInterface,
    KeyValueDataValueType,
    KeyValueJSONOption,
    KeyValueTableOptions,
    KeyValueTypeList,
    LogBlock,
} from "../index.js";
import Cacher from "./newcache.js";
import {
    WriteStream,
    createReadStream,
    createWriteStream,
    readFileSync,
    readdirSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from "fs";
import {
    JSONParser,
    ReferenceConstantSpace,
    createHash,
    createHashRawString,
    decodeHash,
    decrypt,
    encrypt,
    stringify,
} from "../../utils.js";
import { DatabaseEvents, DatabaseMethod, Hash } from "../../index.js";
import { readFile, rename, truncate, writeFile } from "fs/promises";
import Referencer from "../../global/referencer.js";
import QueueManager from "./queue.js";
import Data from "./data.js";
import { setTimeout as wait } from "timers/promises";
import { randomBytes } from "crypto";
import { createInterface } from "readline/promises";
import { Group } from "@akarui/structures";

export default class Table extends EventEmitter {
    #options: KeyValueTableOptions;
    #db: KeyValue;
    #cache: Cacher;
    locked: boolean = false;
    repairMode: boolean = false;
    files!: {
        name: string;
        size: number;
        isInWriteMode: boolean;
    }[];
    paths!: {
        reference: string;
        log: string;
        table: string;
        fullWriter: string;
    };
    logData!: {
        writer: WriteStream;
        size: number;
        fullWriter: WriteStream;
        logIV: string;
    };
    referencer!: Referencer;
    #queue: QueueManager;
    #flushInterval!: NodeJS.Timeout;
    readyAt: number = -1;

    constructor(options: KeyValueTableOptions, db: KeyValue) {
        super();
        this.#options = options;
        this.#db = db;
        this.#cache = new Cacher(this.#db.options.cacheConfig);
        this.#queue = new QueueManager();
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
        this.#db.emit(DatabaseEvents.TableReady, this);
    }

    #enableIntervals() {
        if (this.locked) return;
        this.#flushInterval = setInterval(async () => {
            await this.#flush();
        }, 500);
    }
    async #setReference() {
        this.referencer = new Referencer(
            this.paths.reference,
            this.#db.options.fileConfig.maxSize,
            this.#db.options.cacheConfig.reference,
        );
        await this.referencer.initialize();
    }
    #getPaths() {
        const { path, referencePath } = this.#db.options.dataConfig;
        const transactionLogPath =
            this.#db.options.fileConfig.transactionLogPath;
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

    async #getLogIV(path: string) {
        return new Promise<string>((resolve, reject) => {
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
            const data = readFileSync(
                `${this.paths.table}/${fileObj.name}`,
                "utf-8",
            ).trim();

            const { data: json, isBroken } = JSONParser(data);

            if (isBroken) {
                if (!Object.keys(json).length) {
                    console.warn(
                        `File ${fileObj.name} in table ${
                            this.#options.name
                        } is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${
                            this.#options.name
                        }") to restore the data. from logs`,
                    );
                    this.locked = true;
                    return;
                }
                console.warn(`
Attempting to repair file ${fileObj.name} in table ${
                    this.#options.name
                }. Data found: ${
                    Object.keys(json).length
                }. Please add backup or use the <KeyValue>.fullRepair("${
                    this.#options.name
                }") to restore the data if the data is not correct. `);

                this.repairMode = true;
                const { securityKey, encriptData } =
                    this.#db.options.encryptionConfig;
                let dataToWrite: string;
                if (encriptData) {
                    const decrypted = decrypt(json as Hash, securityKey);

                    const { data: parsed, isBroken } = JSONParser(decrypted);

                    if (isBroken) {
                        console.warn(
                            `File ${fileObj.name} in table ${
                                this.#options.name
                            } is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${
                                this.#options.name
                            }") to restore the data. from logs`,
                        );
                        this.locked = true;
                        return;
                    } else {
                        dataToWrite = JSON.stringify(
                            encrypt(JSON.stringify(parsed), securityKey),
                        );
                    }
                } else {
                    dataToWrite = JSON.stringify(json);
                }

                writeFileSync(
                    `${this.paths.table}/${fileObj.name}`,
                    dataToWrite,
                );
            }
        }
        index++;
    }
    async #syncWithLog() {
        if (this.locked) return;
        const logBlocks = await this.getLogs();
        const reference = await this.referencer.getReference();

        const lastFlushIndex = logBlocks.findLastIndex(
            (block) => block.method === DatabaseMethod.Flush,
        );
        const startIndex = lastFlushIndex === -1 ? 0 : lastFlushIndex + 1;
        for (let index = startIndex; index < logBlocks.length; index++) {
            const { key, value, type, method } = logBlocks[index];
            if (method === DatabaseMethod.Set) {
                let file;
                if (reference[key]) file = reference[key].file;
                else
                    file = await this.#fileToPlace(
                        new Data({ key, value, type, file: "" }),
                    );
                const data = new Data({
                    file,
                    key,
                    value,
                    type,
                });
                if (!file) file = await this.#fileToPlace(data);
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
                if (!reference[key].file) continue;
                this.#queue.add({ key, file: reference[key].file });
                this.#cache.delete(key);
            }
        }

        await this.#initFlush();
        this.#queue.clear("set");
        this.#queue.clear("delete");
    }

    async #syncReferencer() {
        this.referencer.sync(
            this.files.map((file) => file.name),
            this,
        );
    }

    async fetchFile(
        path: string,
    ): Promise<Record<string, KeyValueJSONOption> | undefined> {
        const { securityKey, encriptData } = this.#db.options.encryptionConfig;
        const fileName = path.split("/").at(-1) as string;
        const fileObj = this.files.find((fileObj) => fileObj.name === fileName);
        if (!fileObj) return undefined;
        if (fileObj.size <= 2) return {};
        if (fileObj.isInWriteMode) {
            await wait(100);
            return this.fetchFile(path);
        }
        const dataString = await readFile(path, "utf-8");
        const { data: json, isBroken } = JSONParser(dataString);
        if (isBroken && !Object.keys(json).length) {
            console.warn(
                `File ${path} in table ${
                    this.#options.name
                } is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${
                    this.#options.name
                }") to restore the data. from logs`,
            );
            this.locked = true;
            return;
        }
        if (encriptData) {
            const decrypted = decrypt(json as Hash, securityKey);

            const { data: parsed, isBroken } = JSONParser(decrypted);

            if (isBroken) {
                console.warn(
                    `File ${path} in table ${
                        this.#options.name
                    } is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("${
                        this.#options.name
                    }") to restore the data. from logs`,
                );
                this.locked = true;
                return;
            } else {
                return parsed as Record<string, KeyValueJSONOption>;
            }
        } else {
            return json as Record<string, KeyValueJSONOption>;
        }
    }

    async getLogs() {
        if (this.locked) {
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data. from logs",
            );
        }

        const { securityKey } = this.#db.options.encryptionConfig;

        const blocks: LogBlock[] = [];

        const rl = createInterface({
            input: createReadStream(this.paths.log),
            crlfDelay: Infinity,
        });

        for await (const logLine of rl) {
            const [
                key,
                value,
                type,
                ttl, // ttl for old versions backwards compatibility
                method,
            ] = decodeHash(logLine, securityKey, this.logData.logIV);
            let parsedMethod: DatabaseMethod;
            if (!method) parsedMethod = Number(ttl);
            else parsedMethod = Number(method);

            blocks.push({
                key,
                value,
                type: type as KeyValueTypeList,
                method: parsedMethod,
            });
        }

        return blocks;
    }
    async #fileToPlace(data: Data) {
        const currentFile = this.files.at(-1) as {
            name: string;
            size: number;
            isInWriteMode: boolean;
        };
        const { maxSize } = this.#db.options.fileConfig;
        const fileSize = currentFile.size;
        const setQueue = this.#queue.get("set");
        const size = setQueue[data.file] || 0;

        if (fileSize + size + data.size > maxSize) {
            const newFile = await this.#createFile();
            return newFile.name;
        } else {
            return currentFile.name;
        }
    }

    async #createFile(log: boolean = true) {
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
        if (log) await this.#wal(Data.emptyData(), DatabaseMethod.NewFile);
        return fileObj;
    }

    async #initFlush() {
        const setData = this.#queue.get("set");
        const deleteData = this.#queue.get("delete");

        const reference = await this.referencer.getReference();
        const files = new Set<string>();
        for (const data of setData.data) {
            files.add(data.file);
        }
        for (const { key } of deleteData.data) {
            if (!reference[key]) continue;
            files.add(reference[key].file);
        }

        for (const file of files) {
            const data = await this.fetchFile(`${this.paths.table}/${file}`);
            if (!data) continue;

            for (const dataToAdd of setData.data) {
                if (dataToAdd.file !== file) continue;
                data[dataToAdd.key] = dataToAdd.toJSON();
            }

            for (const { key } of deleteData.data) {
                if (!data[key]) continue;
                delete data[key];
            }

            const { securityKey, encriptData } =
                this.#db.options.encryptionConfig;

            let dataToWrite: string;
            if (encriptData) {
                dataToWrite = JSON.stringify(
                    encrypt(JSON.stringify(data), securityKey),
                );
            } else {
                dataToWrite = JSON.stringify(data);
            }

            await writeFile(`${this.paths.table}/${file}`, dataToWrite);
        }
    }

    async #wal(data: Data, method: DatabaseMethod) {
        return new Promise<void>(async (resolve, reject) => {
            const { key, type, value } = data.toJSON();
            const { securityKey } = this.#db.options.encryptionConfig;

            const delimitedString = createHashRawString([
                key,
                stringify(value),
                type,
                method.toString(),
            ]);

            const logHash = createHash(
                delimitedString,
                securityKey,
                this.logData.logIV,
            );

            this.logData.writer.write(`${logHash}\n`, (logError) => {
                if (logError) {
                    reject(logError);
                    return;
                }
                this.logData.size += logHash.length + 1;
                this.logData.fullWriter.write(
                    `${delimitedString}\n`,
                    async (fullWriterError) => {
                        if (fullWriterError) {
                            reject(fullWriterError);
                            return;
                        }

                        if (method === DatabaseMethod.Flush) {
                            if (
                                this.logData.size >
                                this.#db.options.fileConfig.maxSize
                            ) {
                                await truncate(this.paths.log, 33);
                            }
                        }

                        resolve();
                        return;
                    },
                );
            });
        });
    }

    async set(key: string, dataObj: Partial<KeyValueDataInterface>) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );

        const reference = await this.referencer.getReference();
        let data: Data;
        const { value, type } = dataObj;
        if (reference[key]) {
            data = new Data({
                key,
                value: value as KeyValueDataValueType,
                type: type,
                file: reference[key].file,
            });
        } else {
            data = new Data({
                key,
                value: value as KeyValueDataValueType,
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
        if (this.locked) return;
        if (this.repairMode) return;
        if (
            !this.#queue.getQueueSize("set") &&
            !this.#queue.getQueueSize("delete")
        )
            return;

        const filesToWrite = new Set<string>();
        const QueueData = this.#queue.get("set").data;
        const DeleteQueue = this.#queue.get("delete").data;

        for (const data of QueueData) {
            filesToWrite.add(data.file);
        }
        for (const { file } of DeleteQueue) {
            filesToWrite.add(file);
        }
        const promises: Promise<void>[] = [];
        for (const file of filesToWrite) {
            const promise = new Promise<void>(async (resolve, reject) => {
                const fileObj = this.files.find(
                    (fileObj) => fileObj.name === file,
                );

                if (!fileObj) {
                    resolve();
                    return;
                }
                if (fileObj.isInWriteMode) {
                    resolve();
                    return;
                }

                let fileData = await this.fetchFile(
                    `${this.paths.table}/${file}`,
                );
                fileObj.isInWriteMode = true;

                if (!fileData) {
                    fileData = {};
                }

                for (const data of QueueData) {
                    this.#queue.remove("set", data.key);
                    if (data.file !== file) continue;
                    fileData[data.key] = data.toJSON();
                }

                for (const { key } of DeleteQueue) {
                    this.#queue.remove("delete", key);
                    if (!fileData[key]) continue;
                    delete fileData[key];
                }

                const { securityKey, encriptData } =
                    this.#db.options.encryptionConfig;

                let dataToWrite: string;

                if (encriptData) {
                    dataToWrite = JSON.stringify(
                        encrypt(JSON.stringify(fileData), securityKey),
                    );
                } else {
                    dataToWrite = JSON.stringify(fileData);
                }

                const path = `${this.paths.table}/$temp_${file}`;
                await writeFile(path, dataToWrite);
                await rename(path, `${this.paths.table}/${file}`);
                fileObj.isInWriteMode = false;
                await this.#wal(Data.emptyData(), DatabaseMethod.Flush);
                resolve();
            });

            promises.push(promise);
        }

        await Promise.all(promises);
    }

    async get(key: string) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );
        const data = this.#cache.get(key);
        if (data) return data;
        else {
            const reference = await this.referencer.getReference();
            if (!reference[key]) return null;
            const file = reference[key].file;
            const data = await this.fetchFile(`${this.paths.table}/${file}`);
            if (!data || !Object.keys(data).length) return null;
            this.#cache.bulkFileSet(data, file);
            if (!data[key]) return null;
            const getData = new Data({
                file,
                key,
                value: data[key].value,
                type: data[key].type,
            });
            return getData;
        }
    }
    async has(key: string) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );
        if (this.#cache.has(key)) return true;
        const reference = await this.referencer.getReference();
        return !!reference[key];
    }
    async delete(key: string) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );
        if (this.#cache.has(key)) {
            const data = this.#cache.get(key);
            if (!data) return;

            this.#cache.delete(key);
            await this.#wal(data, DatabaseMethod.Delete);
            await this.referencer.deleteReference(key);
            this.#queue.add({ key, file: data.file });
        } else {
            const reference = await this.referencer.getReference();
            if (!reference[key]) return;

            const file = reference[key].file;
            const emptyData = Data.emptyData();
            emptyData.key = key;
            emptyData.file = file;
            await this.#wal(emptyData, DatabaseMethod.Delete);
            await this.referencer.deleteReference(key);
            this.#queue.add({ key, file });
        }
    }
    async clear() {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );
        this.#cache.clear();
        this.#queue.clear("set");
        this.#queue.clear("delete");
        this.files = [];
        await this.#createFile(false);
        await this.referencer.clear();
        await this.#reset();
    }

    async #reset() {
        return new Promise<void>(async (resolve, reject) => {
            this.logData.writer.close();
            await truncate(this.paths.log, 0);
            this.logData.size = 0;
            this.logData.writer = createWriteStream(this.paths.log, {
                flags: "a",
            });

            const iv = randomBytes(16).toString("hex");
            this.logData.logIV = iv;

            this.logData.writer.write(iv + "\n\n", (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }
    async all(
        query: (d: Data) => boolean,
        limit: number,
        order: "firstN" | "asc" | "desc",
    ) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );

        if (order === "firstN") return this.getFirstN(query, limit);

        const matchedData = await this.findMany(query);
        if (order === "asc")
            return matchedData
                .sort(this.#db.options.cacheConfig.sortFunction)
                .slice(0, limit);
        else
            return matchedData
                .sort(this.#db.options.cacheConfig.sortFunction)
                .slice(-limit);
    }
    async findOne(query: (d: Data) => boolean) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );
        const cacheData = this.#cache.find(query);
        if (cacheData) return cacheData;

        for (const file of this.files) {
            const data = await this.fetchFile(
                `${this.paths.table}/${file.name}`,
            );
            if (!data) continue;

            for (const key in data) {
                const dataObj = new Data({
                    key,
                    file: file.name,
                    value: data[key].value,
                    type: data[key].type,
                });
                if (query(dataObj)) return dataObj;
            }
        }
        return null;
    }

    async findMany(query: (d: Data) => boolean) {
        const matchedCacheData = this.#cache.filter((data) => query(data));
        const res = await this.#findMany(query, matchedCacheData);
        return res;
    }
    async #findMany(query: (d: Data) => boolean, grp: Group<string, Data>) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );

        for (const file of this.files) {
            const data = await this.fetchFile(
                `${this.paths.table}/${file.name}`,
            );
            if (!data) continue;

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

    async getFirstN(query: (d: Data) => boolean, limit: number) {
        if (this.locked)
            throw new Error(
                "Table is locked. please use the <KeyValue>.fullRepair() to restore the data.",
            );
        const cacheData = this.#cache.filter(query).top(limit);
        let data: Data[];
        if (cacheData instanceof Data) data = [cacheData];
        else if (Array.isArray(cacheData)) data = cacheData;
        else data = [];

        if (data.length >= limit) return data.slice(0, limit);

        for (const fileObj of this.files) {
            const fileData = await this.fetchFile(
                `${this.paths.table}/${fileObj.name}`,
            );
            if (!fileData) continue;

            for (const key in fileData) {
                const dataObj = new Data({
                    key,
                    file: fileObj.name,
                    value: fileData[key].value,
                    type: fileData[key].type,
                });
                if (query(dataObj)) {
                    data.push(dataObj);
                    if (data.length === limit) return data;
                }
            }
        }

        return data;
    }

    async deleteMany(query: (d: Data) => boolean) {
        const matchedData = await this.findMany(query);
        for (const data of matchedData) {
            await this.delete(data.key);
        }
    }

    async add(key: string, value: Partial<KeyValueDataInterface>) {
        const data = await this.get(key);
        if (!data) await this.set(key, value);
        else {
            switch (data.type) {
                case "bigint": {
                    data.value += value.value as bigint;
                    break;
                }
                case "number": {
                    data.value += value.value as number;
                    break;
                }
                case "string": {
                    data.value += value.value as string;
                    break;
                }
                case "date": {
                    data.value = new Date(data.value as Date).setMilliseconds(
                        value.value as number,
                    );
                    break;
                }
                case "object": {
                    if (Array.isArray(data.value)) {
                        data.value.push(...(value.value as any[]));
                    } else {
                        data.value = {
                            ...data.value,
                            ...(value.value as Record<string, any>),
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

    async subtract(key: string, value: Partial<KeyValueDataInterface>) {
        const data = await this.get(key);
        if (!data) await this.set(key, value);
        else {
            switch (data.type) {
                case "bigint": {
                    data.value -= value.value as bigint;
                    break;
                }
                case "number": {
                    data.value -= value.value as number;
                    break;
                }
                case "string": {
                    data.value = (data.value as string).replace(
                        value.value as string,
                        "",
                    );
                    break;
                }
                case "date": {
                    data.value = new Date(data.value as Date).setMilliseconds(
                        -(value.value as number),
                    );
                    break;
                }
                case "object": {
                    if (Array.isArray(data.value)) {
                        data.value = (data.value as any[]).filter(
                            (v) => !(value.value as any[]).includes(v),
                        );
                    } else {
                        const obj = data.value as Record<string, any>;
                        for (const key in value.value as Record<string, any>) {
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

        const dataToAdd: Group<string, Data> = new Group(Infinity);

        for await (const logLine of rl) {
            const [
                key,
                value,
                type,
                ttl, // ttl for old versions backwards compatibility
                method,
            ] = logLine.split(ReferenceConstantSpace);
            let parsedMethod: DatabaseMethod;
            if (!method) parsedMethod = Number(ttl);
            else parsedMethod = Number(method);

            if (parsedMethod === DatabaseMethod.Set) {
                const data = new Data({
                    key,
                    value,
                    type: type as KeyValueTypeList,
                    file: "",
                });
                const file = this.files.at(-1)?.name as string;
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

        const files = new Set<string>();
        const dataArray = dataToAdd.V();
        for (const data of dataArray) {
            files.add(data.file);
        }

        const promises: Promise<void>[] = [];

        for (const file of files) {
            const promise = new Promise<void>(async (resolve, reject) => {
                const path = `${this.paths.table}/${file}`;
                let dataToWrite: string;

                const filteredData = dataArray.filter(
                    (data) => data.file === file,
                );

                const { securityKey, encriptData } =
                    this.#db.options.encryptionConfig;

                if (encriptData) {
                    const dataObj: Record<string, KeyValueJSONOption> = {};

                    for (const data of filteredData) {
                        dataObj[data.key] = data.toJSON();
                    }

                    dataToWrite = JSON.stringify(
                        encrypt(JSON.stringify(dataObj), securityKey),
                    );
                } else {
                    const dataObj: Record<string, KeyValueJSONOption> = {};

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
