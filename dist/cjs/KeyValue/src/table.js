"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const utils_js_1 = require("../../utils.js");
const enum_js_1 = require("../../typings/enum.js");
const data_js_1 = __importDefault(require("./data.js"));
const promises_1 = require("fs/promises");
const referencer_js_1 = __importDefault(require("./referencer.js"));
const events_1 = require("events");
const cache_js_1 = __importDefault(require("./cache.js"));
class Table extends events_1.EventEmitter {
    options;
    db;
    paths;
    files;
    logHash;
    #queue = {
        set: [],
        delete: {},
    };
    #cache;
    #queued = {
        set: false,
        reference: false,
        delete: false,
    };
    #intervals = {
        set: null,
        delete: null,
    };
    referencer;
    readyAt;
    logData;
    locked = false;
    repairMode = false;
    /**
     *
     * @description Creates a new table
     *
     * @mermaid
     * graph LR;
     * A[KeyValue] --> B[Table];
     *
     *
     * @param options The options for the table
     * @param db The database instance
     */
    constructor(options, db) {
        super();
        this.options = options;
        this.#cache = new cache_js_1.default(db.options.cacheConfig);
        this.db = db;
    }
    /**
     * @private
     * @description Initializes the table
     */
    async initialize() {
        this.paths = {
            reference: `${this.db.options.dataConfig.referencePath}/${this.options.name}`,
            log: `${this.db.options.fileConfig.transactionLogPath}/${this.options.name}/transaction.log`,
        };
        this.logHash = await this.#getHashLog();
        this.files = (0, fs_1.readdirSync)(`${this.db.options.dataConfig.path}/${this.options.name}`).map((file) => {
            const stats = (0, fs_1.statSync)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`);
            // const writer = createWriteStream(
            //     `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`,
            // );
            return {
                name: file,
                size: stats.size,
                // writer,
            };
        });
        this.referencer = new referencer_js_1.default(this.paths.reference, this.db.options.fileConfig.maxSize, this.db.options.cacheConfig.reference);
        await this.referencer.initialize();
        this.logData = {
            writer: (0, fs_1.createWriteStream)(this.paths.log, {
                flags: "a",
            }),
            size: (0, fs_1.statSync)(this.paths.log).size,
            fullWriter: (0, fs_1.createWriteStream)(this.db.options.fileConfig.transactionLogPath +
                `/${this.options.name}/fullWriter.log`, {
                flags: "a",
            }),
        };
        this.#checkIntegrity();
        await this.#syncWithLogs();
        this.readyAt = Date.now();
        this.db.emit(enum_js_1.DatabaseEvents.TableReady, this);
    }
    /**
     * @private
     * @description Checks the integrity of the table and does a small self repair if needed
     */
    async #checkIntegrity() {
        const files = this.files.map((x) => x.name);
        let index = 0;
        for (const file of files) {
            const data = (0, fs_1.readFileSync)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`, "utf-8").trim();
            const { data: json, isBroken } = (0, utils_js_1.JSONParser)(data);
            if (isBroken && !file.startsWith("$temp_")) {
                if (Object.keys(json).length === 0) {
                    console.warn(`File ${file} in table ${this.options.name} is corrupted. Data found: 0. Locking table. please add backup or use the <KeyValue>.fullRepair("tableName") to restore the data. from logs`);
                    // latest backup
                    this.locked = true;
                    return;
                }
                else {
                    console.warn(`Attempting self fix on file ${file} in table ${this.options.name}.`);
                    if (this.db.options.encryptionConfig.encriptData) {
                        const decrypted = (0, utils_js_1.decrypt)(json, this.db.options.encryptionConfig.securityKey);
                        const { data: parsed, isBroken } = (0, utils_js_1.JSONParser)(decrypted);
                        if (isBroken) {
                            (0, fs_1.writeFileSync)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`, JSON.stringify((0, utils_js_1.encrypt)(JSON.stringify(parsed), this.db.options.encryptionConfig
                                .securityKey)));
                            console.warn(`Attempted self fix on file ${file} in table ${this.options.name}. If the file is still corrupted, please use the <KeyValue>.fullRepair("tableName") to restore the data.`);
                        }
                    }
                    else {
                        (0, fs_1.writeFileSync)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`, JSON.stringify(json));
                        console.warn(`Attempted self fix on file ${file} in table ${this.options.name}. If the file is still corrupted, please use the <KeyValue>.fullRepair("tableName") to restore the data.`);
                    }
                }
            }
            if (file.startsWith("$temp_")) {
                // this.files.find(x => x.name === file)?.writer?.close();
                (0, fs_1.unlinkSync)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`);
                this.files.splice(index, 1);
            }
            const reference = await this.referencer.getReference();
            for (const key of Object.keys(json)) {
                if (!reference[key]) {
                    await this.referencer.setReference(key, file);
                }
            }
            index++;
        }
    }
    /**
     * @private
     * @description Syncs the table with the transaction log
     */
    async #syncWithLogs() {
        const logs = await this.getLogs();
        const reference = await this.referencer.getReference();
        const lastFlush = logs.findLastIndex((log) => log.method === enum_js_1.DatabaseMethod.Flush);
        if (lastFlush !== -1 || lastFlush !== logs.length - 1) {
            const dataToAdd = logs.slice(lastFlush + 1);
            for (const data of dataToAdd) {
                if (data.method === enum_js_1.DatabaseMethod.Set) {
                    let file = reference[data.key].file;
                    if (!file)
                        return;
                    else {
                        this.#queue.set.push(new data_js_1.default({
                            file,
                            key: data.key,
                            value: data.value,
                            type: data.type,
                        }));
                    }
                }
            }
            if (this.#queue.set.length) {
                await this.#set();
            }
        }
    }
    /**
     * @private
     * @description Gets the hash of the transaction log
     * @returns The hash of the transaction log
     *
     */
    async #getHashLog() {
        const logStream = (0, fs_1.createReadStream)(this.paths.log);
        return new Promise((resolve, reject) => {
            let hash = "";
            logStream.on("readable", () => {
                const data = logStream.read(32);
                if (data) {
                    hash += data.toString();
                }
                logStream.close();
            });
            logStream.on("close", () => {
                resolve(hash);
            });
            logStream.on("error", (err) => {
                reject(err);
            });
        });
    }
    /**
     * @private
     * @description Writes to the transaction log
     * @param data data to write to the transaction log
     * @param method the method used when wal was called
     * @returns
     */
    async #wal(data, method) {
        const json = data.toJSON();
        const { key, type, value } = json;
        const delimitedString = (0, utils_js_1.createHashRawString)([
            key,
            (value ?? "null")?.toString(),
            type,
            method?.toString(),
        ]);
        const hash = (0, utils_js_1.createHash)(delimitedString, this.db.options.encryptionConfig.securityKey, this.logHash);
        const hashSize = Buffer.byteLength(hash + "\n", "utf-8");
        this.logData.writer.write(`${hash}\n`, () => {
            this.logData.size += hashSize;
        });
        this.logData.fullWriter.write(`${delimitedString}\n`);
        if (method === enum_js_1.DatabaseMethod.Flush) {
            if (this.logData.size > this.db.options.fileConfig.maxSize) {
                await (0, promises_1.truncate)(this.paths.log, 33);
            }
        }
        return;
    }
    /**
     * @description Sets the data in the file
     * @private
     * @returns
     */
    async #set() {
        if (this.#queued.set)
            return;
        this.#queued.set = true;
        if (!this.#queue.set.length) {
            this.#queued.set = false;
            clearInterval(this.#intervals.set);
            this.#intervals.set = null;
            return;
        }
        if (this.#cache.size !== -1) {
            for (const files of this.files) {
                const Jdata = JSON.parse((await (0, promises_1.readFile)(`${this.db.options.dataConfig.path}/${this.options.name}/${files.name}`))
                    .toString()
                    .trim());
                if (this.db.options.encryptionConfig.encriptData) {
                    const decrypted = (0, utils_js_1.decrypt)(Jdata, this.db.options.encryptionConfig.securityKey);
                    const json = JSON.parse(decrypted);
                    this.#cache.replace(files.name, json);
                }
                else {
                    this.#cache.replace(files.name, Jdata);
                }
            }
            setTimeout(() => {
                this.#cache.clearAll();
                this.#cache.size = -1;
            }, 60000);
        }
        const fileSetToWrite = new Set(this.#queue.set.map((data) => {
            return this.files.find((file) => file.name === data.file);
        }));
        for (const data of this.#queue.set) {
            const file = this.files.find((file) => file.name === data.file);
            if (!file) {
                throw new Error("File not found");
            }
            this.#cache.set(data.key, data.toJSON(), file.name);
        }
        for (const file of fileSetToWrite) {
            const json = this.#cache.toJSON(file.name);
            if (this.db.options.encryptionConfig.encriptData) {
                const encrypted = (0, utils_js_1.encrypt)(JSON.stringify(json), this.db.options.encryptionConfig.securityKey);
                // file.writer.write(JSON.stringify(encrypted),async() =>{
                //     await rename(
                //         `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                //         `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                //     );
                // });
                await (0, promises_1.writeFile)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`, JSON.stringify(encrypted));
            }
            else {
                // file.writer.write(JSON.stringify(json), async () => {
                //     await rename(
                //         `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                //         `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                //     );
                // });
                await (0, promises_1.writeFile)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`, JSON.stringify(json));
            }
            try {
                await (0, promises_1.rename)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`, `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`);
            }
            catch { }
        }
        this.#queue.set = [];
        await this.#wal(data_js_1.default.emptyData(), enum_js_1.DatabaseMethod.Flush);
        this.#queued.set = false;
    }
    /**
     * @description Gets the current file
     * @returns The current file
     */
    #getCurrentFile() {
        return this.files.at(-1)?.name;
    }
    /**
     * @private
     * @description Creates a new file
     * @returns The name of the new file
     */
    async #createNewFile() {
        const newFile = `${this.options.name}_scheme_${this.files.length}${this.db.options.fileConfig.extension}`;
        const newFilePath = `${this.db.options.dataConfig.path}/${this.options.name}/${newFile}`;
        await (0, promises_1.writeFile)(newFilePath, JSON.stringify((0, utils_js_1.encrypt)(`{}`, this.db.options.encryptionConfig.securityKey)));
        const writer = (0, fs_1.createWriteStream)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${newFile}`);
        this.files.push({
            name: newFile,
            size: await this.#fileSize(newFile),
            writer,
        });
        await this.#wal(new data_js_1.default({
            file: newFile,
            key: "",
            value: null,
            type: "",
        }), enum_js_1.DatabaseMethod.NewFile);
        return newFile;
    }
    /**
     * @description Sets the data in the file
     * @param key The key of the data
     * @param value The value of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.set("key", {
     *  value: "value",
     * })
     * ```
     *
     */
    async set(key, value) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const reference = await this.referencer.getReference();
        let data;
        if (reference.hasOwnProperty(key)) {
            const file = reference[key].file;
            data = new data_js_1.default({
                file,
                key,
                value: value.value,
                type: value.type ?? undefined,
            });
        }
        else {
            let file = this.#getCurrentFile();
            data = new data_js_1.default({
                file,
                key,
                value: value.value,
                type: value.type ?? undefined,
            });
        }
        const jsonSize = data.size;
        const fileSize = this.files.find((file) => file.name === data.file)
            ?.size;
        if (fileSize + jsonSize > this.db.options.fileConfig.maxSize) {
            data.file = await this.#createNewFile();
        }
        if (reference[data.key]?.file !== data.file) {
            this.referencer.setReference(data.key, data.file);
        }
        this.#queue.set.push(data);
        await this.#wal(data, enum_js_1.DatabaseMethod.Set);
        if (!this.#queued.set) {
            if (this.#intervals.set) {
                clearInterval(this.#intervals.set);
            }
            this.#intervals.set = setInterval(async () => {
                await this.#set();
            }, 100);
        }
        return data;
    }
    /**
     * @private
     * @description gets the size of the file
     * @param file The file to get the size of
     * @returns The size of the file
     */
    async #fileSize(file) {
        const stats = await (0, promises_1.stat)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`);
        return stats.size;
    }
    /**
     * @description get the transaction log
     * @returns The transaction log
     *
     * @example
     * ```js
     * <KeyValueTable>.getLogs()
     * ```
     */
    async getLogs() {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const logs = await (0, promises_1.readFile)(this.paths.log);
        const arr = logs.toString().trim().split("\n").slice(2);
        const block = [];
        for (const log of arr) {
            const [key, value, type, ttl, method] = (0, utils_js_1.decodeHash)(log, this.db.options.encryptionConfig.securityKey, this.logHash);
            block.push({
                key,
                value: value === "null" ? null : value,
                type,
                ttl: ttl === "-1" ? -1 : Number(ttl),
                method: Number(method),
            });
        }
        return block;
    }
    /**
     * @description Gets the queue
     * @returns The queue
     * @readonly
     *
     * @example
     * ```js
     * <KeyValueTable>.queue
     * ```
     */
    get queue() {
        return this.#queue;
    }
    /**
     * @description Get the value for the key
     * @param key The key of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.get("key")
     * ```
     */
    async get(key) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const reference = await this.referencer.getReference();
        if (!reference[key])
            return null;
        const file = reference[key].file;
        const data = this.#cache.get(key, file);
        if (data) {
            return new data_js_1.default({
                file,
                key,
                value: data.value,
                type: data.type,
            });
        }
        const d = (await this.#get(key, file));
        return new data_js_1.default({
            file,
            key,
            value: d?.value,
            type: d?.type,
        });
    }
    /**
     * @private
     * @param key key of the data
     * @param file file where the data is stored
     * @returns
     */
    async #get(key, file) {
        const data = (await (0, promises_1.readFile)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`, "utf-8")).trim();
        if (this.db.options.encryptionConfig.encriptData) {
            const decrypted = (0, utils_js_1.decrypt)(JSON.parse(data), this.db.options.encryptionConfig.securityKey);
            const json = JSON.parse(decrypted);
            this.#cache.replace(file, json);
        }
        else {
            const json = JSON.parse(data);
            this.#cache.replace(file, json);
        }
        setTimeout(() => {
            delete this.#cache.data[file];
        }, 60000);
        return this.#cache.get(key, file);
    }
    /**
     * @description Deletes the data
     * @param key The key of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.delete("key")
     * ```
     */
    async delete(key) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const reference = await this.referencer.getReference();
        if (!reference[key])
            return null;
        const file = reference[key].file;
        return await this.#delete(key, file);
    }
    /**
     * @private
     * @param key The key of the data
     * @param file The file where the data is stored
     * @returns
     */
    async #delete(key, file) {
        const path = `${this.db.options.dataConfig.path}/${this.options.name}/${file}`;
        let data = undefined;
        if (this.#cache.data[file]?.size) {
            const c = this.#cache.get(key, file);
            data = new data_js_1.default({
                file,
                key,
                value: c?.value,
                type: c?.type,
            });
            this.#cache.delete(key, file);
        }
        if (!data) {
            const p = (await (0, promises_1.readFile)(path, "utf-8")).trim();
            const json = JSON.parse(p);
            if (this.db.options.encryptionConfig.encriptData) {
                const decrypted = (0, utils_js_1.decrypt)(json, this.db.options.encryptionConfig.securityKey);
                const parsed = JSON.parse(decrypted);
                this.#cache.replace(file, parsed);
            }
            else {
                this.#cache.replace(file, json);
            }
            const c = this.#cache.get(key, file);
            data = new data_js_1.default({
                file,
                key,
                value: c?.value,
                type: c?.type,
            });
        }
        this.#cache.delete(key, file);
        await this.#wal(data, enum_js_1.DatabaseMethod.Delete);
        await this.referencer.deleteReference(key);
        if (!this.queue.delete[file]) {
            this.#queue.delete[file] = {};
            this.#queue.delete[file] = await this.#fetchFile(file);
            delete this.#queue.delete[file][key];
        }
        else {
            delete this.#queue.delete[file][key];
        }
        if (!this.#queued.delete) {
            this.#queued.delete = true;
            if (this.#intervals.delete) {
                clearInterval(this.#intervals.delete);
            }
            this.#intervals.delete = setInterval(async () => {
                await this.#deleteFlush();
            }, 100);
        }
        return data;
    }
    /**
     * @private
     * @description Flushes the delete queue
     *
     * @returns
     */
    async #deleteFlush() {
        if (!this.#queued.delete || !Object.keys(this.#queue.delete).length) {
            this.#queued.delete = false;
            clearInterval(this.#intervals.delete);
            this.#intervals.delete = null;
            return;
        }
        for (const file of Object.keys(this.#queue.delete)) {
            const json = this.#queue.delete[file];
            if (Object.keys(json).length === 0) {
                delete this.#queue.delete[file];
                continue;
            }
            if (this.db.options.encryptionConfig.encriptData) {
                const encrypted = (0, utils_js_1.encrypt)(JSON.stringify(json), this.db.options.encryptionConfig.securityKey);
                await (0, promises_1.writeFile)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`, JSON.stringify(encrypted));
            }
            else {
                await (0, promises_1.writeFile)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`, JSON.stringify(json));
            }
            delete this.#queue.delete[file];
            await (0, promises_1.rename)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`, `${this.db.options.dataConfig.path}/${this.options.name}/${file}`);
        }
    }
    /**
     * @description Clears the table
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.clear()
     * ```
     */
    async clear() {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        this.#cache.clearAll();
        await (0, promises_1.truncate)(this.paths.log, 33);
        for (const file of this.files) {
            if (file.name !== this.files[0].name) {
                file.writer?.close();
                await (0, promises_1.unlink)(`${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`);
            }
            else {
                await (0, promises_1.writeFile)(`${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`, JSON.stringify(this.db.options.encryptionConfig.encriptData
                    ? (0, utils_js_1.encrypt)(JSON.stringify({}), this.db.options.encryptionConfig.securityKey)
                    : {}));
                file.size = await this.#fileSize(file.name);
            }
        }
        this.files = [this.files[0]];
        this.referencer.clear();
    }
    /**
     * @description Checks if the key exists
     * @param key The key of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.has("key")
     * ```
     */
    async has(key) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const reference = await this.referencer.getReference();
        if (!reference[key])
            return false;
        return true;
    }
    /**
     * @description Fetches the file
     * @param file The file to fetch
     * @returns The file
     * @private
     */
    async #fetchFile(file) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const data = (await (0, promises_1.readFile)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`, "utf-8")).trim();
        let json = {};
        if (this.db.options.encryptionConfig.encriptData) {
            const decrypted = (0, utils_js_1.decrypt)(JSON.parse(data), this.db.options.encryptionConfig.securityKey);
            json = JSON.parse(decrypted);
        }
        else {
            json = JSON.parse(data);
        }
        return json;
    }
    /**
     * @description Finds the data
     * @param query The query to find the data
     * @returns The data
     *
     * @example
     * ```js
     * <KeyValueTable>.findOne((v, index) => v.value === "value")
     * ```
     */
    async findOne(query) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const files = this.files.map((file) => file.name);
        for (const file of files) {
            let json = this.#cache.getFileCache(file);
            if (json) {
                let index = 0;
                for (const values of json.values()) {
                    const data = new data_js_1.default({
                        file,
                        key: values.key,
                        value: values.value,
                        type: values.type,
                    });
                    if (query(data, index++)) {
                        return data;
                    }
                }
            }
            else {
                json = await this.#fetchFile(file);
                this.#cache.replace(file, json);
                let index = 0;
                for (const values of Object.values(json)) {
                    const data = new data_js_1.default({
                        file,
                        key: values.key,
                        value: values.value,
                        type: values.type,
                    });
                    if (query(data, index++)) {
                        return data;
                    }
                }
            }
        }
        return null;
    }
    /**
     *
     * @param query The query to find the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.findMany((v, index) => v.value === "value")
     * ```
     */
    async findMany(query) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const files = this.files.map((file) => file.name);
        const data = [];
        for (const file of files) {
            let json = this.#cache.getFileCache(file);
            if (json) {
                let index = 0;
                for (const values of json.values()) {
                    const d = new data_js_1.default({
                        file,
                        key: values.key,
                        value: values.value,
                        type: values.type,
                    });
                    if (query(d, index++)) {
                        data.push(d);
                    }
                }
            }
            else {
                json = await this.#fetchFile(file);
                this.#cache.replace(file, json);
                let index = 0;
                for (const values of Object.values(json)) {
                    const d = new data_js_1.default({
                        file,
                        key: values.key,
                        value: values.value,
                        type: values.type,
                    });
                    if (query(d, index++)) {
                        data.push(d);
                    }
                }
            }
        }
        return data;
    }
    /**
     *
     * @param query The query to find the data
     * @param limit  The limit of the data
     * @returns
     *
     * @example
     * ```js
     * <KeyValueTable>.all(() => true, 10) // returns the first 10 data
     * ```
     */
    async all(query, limit) {
        if (this.locked)
            throw new Error("Table is locked. Please use the <KeyValue>.fullRepair() to restore the data.");
        const allData = await this.findMany(query ?? (() => true));
        if (limit)
            return allData.slice(0, limit);
        return allData;
    }
    /**
     * @description Executes a full repair on the table
     * @returns
     *
     * @example
     * <KeyValueTable>.fullRepair()
     *
     * @note This method is very slow and should only be used when the table is corrupted
     */
    async fullRepair() {
        this.repairMode = true;
        this.locked = false;
        for (const file of this.files) {
            file.writer?.close();
            if (file.name !==
                `${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`) {
                await (0, promises_1.unlink)(`${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`);
            }
        }
        await this.referencer.clear();
        this.logData.writer.close();
        await (0, promises_1.truncate)(this.paths.log, 33);
        await (0, promises_1.truncate)(`${this.db.options.dataConfig.path}/${this.options.name}/${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`, 0);
        const mainObj = {
            [`${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`]: {},
        };
        let currentFile = `${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`;
        let fileNum = 1;
        const fullLogReader = (0, fs_1.createReadStream)(`${this.db.options.fileConfig.transactionLogPath}/${this.options.name}/fullWriter.log`);
        // read logger line by line
        let line = "";
        let buffer = "";
        await new Promise((resolve, reject) => {
            fullLogReader.on("readable", () => {
                buffer += fullLogReader.read();
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    const [key, value, type, ttl, method] = line.split(utils_js_1.ReferenceConstantSpace);
                    if (method === enum_js_1.DatabaseMethod.Set.toString()) {
                        const data = {
                            key,
                            value,
                            type,
                            ttl: Number(ttl),
                        };
                        mainObj[currentFile][key] = data;
                    }
                    if (method === enum_js_1.DatabaseMethod.NewFile.toString()) {
                        currentFile = `${this.options.name}_scheme_${fileNum}${this.db.options.fileConfig.extension}`;
                        fileNum++;
                        mainObj[currentFile] = {};
                    }
                    if (method === enum_js_1.DatabaseMethod.Delete.toString()) {
                        delete mainObj[currentFile][key];
                    }
                }
            });
            fullLogReader.on("close", async () => {
                for (const file of Object.keys(mainObj)) {
                    await (0, promises_1.writeFile)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`, JSON.stringify(this.db.options.encryptionConfig.encriptData
                        ? (0, utils_js_1.encrypt)(JSON.stringify(mainObj[file]), this.db.options.encryptionConfig
                            .securityKey)
                        : mainObj[file]));
                }
                resolve();
            });
            fullLogReader.on("error", (err) => {
                reject(err);
            });
        });
        this.files = (0, fs_1.readdirSync)(`${this.db.options.dataConfig.path}/${this.options.name}`).map((file) => {
            const stats = (0, fs_1.statSync)(`${this.db.options.dataConfig.path}/${this.options.name}/${file}`);
            const writer = (0, fs_1.createWriteStream)(`${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`);
            return {
                name: file,
                size: stats.size,
                writer,
            };
        });
        this.logData.writer = (0, fs_1.createWriteStream)(this.paths.log, {
            flags: "a",
        });
        this.logData.size = (0, fs_1.statSync)(this.paths.log).size;
        const keyFileList = Object.entries(mainObj).map(([file, data]) => {
            return {
                string: `${data.key}${utils_js_1.ReferenceConstantSpace}${file}`,
                size: Buffer.byteLength(`${data.key}${utils_js_1.ReferenceConstantSpace}${file}`),
            };
        });
        // split the keyFiles according to the max size
        const keyFileParts = [[]];
        let currentPart = 0;
        let currentSize = 0;
        for (const kf of keyFileList) {
            if (currentSize + kf.size > this.db.options.fileConfig.maxSize) {
                currentPart += 1;
                currentSize = 0;
                keyFileParts[currentPart] = [kf];
            }
            else {
                keyFileParts[currentPart].push(kf);
            }
        }
        let currentRefFile = "reference_1.log";
        let refFileNum = 1;
        for (const part of keyFileParts) {
            const data = part.map((x) => x.string).join("\n");
            await (0, promises_1.writeFile)(`${this.db.options.dataConfig.referencePath}/${this.options.name}/${currentRefFile}`, data);
            refFileNum += 1;
            currentRefFile = `reference_${refFileNum}.log`;
        }
        this.referencer.restart();
        this.repairMode = false;
        return true;
    }
    /**
     * @description Deletes the data
     * @param query The query to find the data
     * @returns The data deleted if query is provided else boolean if whole table is cleared
     * @example
     * ```js
     * <KeyValueTable>.deleteMany((v, index) => v.value === "value")
     * ```
     */
    async deleteMany(query) {
        if (!query) {
            await this.clear();
            return true;
        }
        else {
            const data = await this.findMany(query);
            for (const d of data) {
                if (!this.#queue.delete[d.file])
                    this.#queue.delete[d.file] = await this.#fetchFile(d.file);
                delete this.#queue.delete[d.file][d.key];
            }
            this.#wal(data_js_1.default.emptyData(), enum_js_1.DatabaseMethod.DeleteMany);
            if (!this.#queued.delete) {
                this.#queued.delete = true;
                if (this.#intervals.delete) {
                    clearInterval(this.#intervals.delete);
                }
                this.#intervals.delete = setInterval(async () => {
                    await this.#deleteFlush();
                }, 100);
            }
            return data;
        }
    }
    async addTableToLog() {
        const allData = await this.all();
        for (const data of allData) {
            await this.#wal(data, enum_js_1.DatabaseMethod.Set);
        }
        if (this.db.options.debug) {
            console.log(`Synced table ${this.options.name} with the transaction log`);
        }
    }
}
exports.default = Table;
//# sourceMappingURL=table.js.map