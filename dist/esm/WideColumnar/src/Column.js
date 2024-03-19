import { createReadStream, createWriteStream, existsSync, readdirSync, rmSync, truncateSync, } from "fs";
import { appendFile, truncate, unlink } from "fs/promises";
import MemMap from "./MemMap.js";
import WideColumnarData from "./Data.js";
import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import readline from "readline/promises";
import { ReferenceConstantSpace, createHash, createHashRawString, decrypt, encrypt, parse, stringify, } from "../../utils.js";
import { DatabaseMethod } from "../../index.js";
import WideColumnarReferencer from "./Referencer.js";
export default class WideColumnarColumn {
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
        return readdirSync(this.path).filter((x) => x.endsWith(this.table.db.options.fileConfig.extension));
    }
    async initialize() {
        await this.#initalize();
        await this.#getLogInfo();
        await this.#syncWithLogs();
    }
    async #initalize() {
        this.memMap = new MemMap({
            limit: this.table.db.options.cacheConfig.limit,
            sortFunction: this.table.db.options.cacheConfig.sortFunction,
        }, this);
        const transactionPath = `${this.path}/transaction.wdcl`;
        const fullWriterPath = `${this.path}/fullWriter.wdcl`;
        if (!existsSync(transactionPath)) {
            const IV = randomBytes(16).toString("hex");
            await writeFile(transactionPath, IV + "\n\n");
        }
        if (!existsSync(fullWriterPath)) {
            const IV = randomBytes(16).toString("hex");
            await writeFile(fullWriterPath, IV + "\n\n");
        }
        const referencePath = `${this.table.db.options.dataConfig.path}/${this.table.db.options.dataConfig.referencePath}/${this.table.name}/${this.name}/${this.name}.wdcr`;
        if (!existsSync(referencePath)) {
            await writeFile(referencePath, "");
        }
        this.referencer = new WideColumnarReferencer(`${this.table.db.options.dataConfig.path}/${this.table.db.options.dataConfig.referencePath}/${this.table.name}/${this.name}`, this.table.db.options.cacheConfig.limit, this.table.db.options.cacheConfig.referenceType, this);
        this.setFiles();
    }
    async #readIvfromLog() {
        const logFile = `${this.path}/transaction.wdcl`;
        return new Promise(async (res, rej) => {
            if (!existsSync(logFile)) {
                rej("log file not found");
            }
            else {
                let iv;
                const rs = createReadStream(logFile, {
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
            if (!existsSync(logFile)) {
                rej("log file not found");
            }
            else {
                let iv;
                const rs = createReadStream(logFile, {
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
            writer: createWriteStream(`${this.path}/transaction.wdcl`, {
                flags: "a",
                encoding: "utf8",
            }),
            fullWriter: createWriteStream(`${this.path}/fullWriter.wdcl`, {
                flags: "a",
                encoding: "utf8",
            }),
            ivFull: await this.#readIvfromFullLog(),
        };
    }
    async #syncWithLogs() {
        const logFile = this.#log.path;
        const rl = readline.createInterface({
            input: createReadStream(logFile),
            crlfDelay: Infinity,
        });
        let index = 0;
        for await (const line of rl) {
            if (index < 2) {
                index++;
                continue;
            }
            const decrypted = decrypt({
                iv: this.#log.iv,
                data: line,
            }, this.table.db.options.encryptionConfig.securityKey);
            const [columnValue, columnType, primaryValue, primaryType, method] = decrypted.split(ReferenceConstantSpace);
            const parsedMethod = Number(method.trim());
            const data = new WideColumnarData({
                column: {
                    name: this.name,
                    type: columnType,
                    value: parse(columnValue, columnType),
                },
                primary: {
                    name: this.table.primary.name,
                    type: this.table.primary.type,
                    value: parse(primaryValue, primaryType),
                },
            });
            if (parsedMethod === DatabaseMethod.Set) {
                this.memMap.set(data);
            }
            else if (parsedMethod === DatabaseMethod.Delete) {
                this.memMap.delete(data.primary.value);
            }
        }
    }
    async #createNewLogCycle() {
        return new Promise((res, rej) => {
            this.#log.writer.end(async () => {
                const IV = randomBytes(16).toString("hex");
                truncateSync(this.#log.path);
                this.#log.iv = IV;
                await appendFile(this.#log.path, IV + "\n\n");
                this.#log.writer = createWriteStream(this.#log.path, {
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
            const delimitedString = createHashRawString([
                stringify(json.column.value),
                json.column.type,
                stringify(json.primary.value),
                json.primary.type,
                method?.toString(),
            ]);
            const hash = createHash(delimitedString, this.table.db.options.encryptionConfig.securityKey, this.#log.iv);
            const fullHash = createHash(delimitedString, this.table.db.options.encryptionConfig.securityKey, this.#log.ivFull);
            await appendFile(this.#log.path, hash + "\n");
            await appendFile(`${this.path}/fullWriter.wdcl`, fullHash + "\n");
            res();
        });
    }
    async flush(data) {
        return new Promise(async (res, rej) => {
            const path = `${this.path}/${this.name}_${this.files.length}${this.table.db.options.fileConfig.extension}`;
            data = data.sort(this.table.db.options.cacheConfig.sortFunction);
            const dataToWrite = data.map((x) => {
                const encrypted = encrypt(x.toString(), this.table.db.options.encryptionConfig.securityKey);
                return `${encrypted.iv}.${encrypted.data}`;
            });
            await writeFile(path, dataToWrite.join("\n"));
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
        const data = new WideColumnarData({
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
        await this.#wal(data, DatabaseMethod.Set);
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
            const file = reference[stringify(primary)];
            if (file) {
                const line = await this.#fetchLine(file.file, file.index);
                if (line === null) {
                    res(null);
                    return;
                }
                const [iv, ecrypted] = line.split(".");
                const decrpyted = decrypt({ data: ecrypted, iv }, this.table.db.options.encryptionConfig.securityKey);
                const json = JSON.parse(decrpyted);
                const data = new WideColumnarData(json);
                res(data);
            }
            else {
                res(null);
            }
        });
    }
    async #fetchLine(file, index) {
        const stream = createReadStream(file);
        const rl = readline.createInterface({
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
        return reference[stringify(primary)] !== undefined;
    }
    async delete(primary) {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return;
        }
        const data = new WideColumnarData({
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
        await this.#wal(data, DatabaseMethod.Delete);
        if (this.memMap.has(primary)) {
            this.memMap.delete(primary);
        }
        else {
            await this.#delete(primary);
        }
    }
    async #delete(primary) {
        const reference = await this.referencer.getReference();
        const file = reference[stringify(primary)];
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
                const encrypted = encrypt(x.toString(), this.table.db.options.encryptionConfig.securityKey);
                return `${encrypted.iv}.${encrypted.data}`;
            });
            await writeFile(file, dataToWrite.join("\n"));
            res();
        });
    }
    async clear() {
        if (this.repairMode) {
            console.warn("Repair mode is on, this will not be logged");
            return;
        }
        this.memMap = new MemMap({
            limit: this.table.db.options.cacheConfig.limit,
            sortFunction: this.table.db.options.cacheConfig.sortFunction,
        }, this);
        await this.referencer.clear();
        rmSync(this.path, { recursive: true });
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
        const stream = createReadStream(file);
        const rl = readline.createInterface({
            input: stream,
            crlfDelay: Infinity,
        });
        const data = [];
        for await (const line of rl) {
            const [iv, ecrypted] = line.split(".");
            const decrpyted = decrypt({ data: ecrypted, iv }, this.table.db.options.encryptionConfig.securityKey);
            const json = JSON.parse(decrpyted);
            const d = new WideColumnarData(json);
            data.push(d);
        }
        return data;
    }
    async #findOne(query) {
        const files = this.files;
        for (const file of files) {
            const stream = createReadStream(`${this.path}/${file}`);
            const rl = readline.createInterface({
                input: stream,
                crlfDelay: Infinity,
            });
            let i = 0;
            for await (const line of rl) {
                const [iv, ecrypted] = line.split(".");
                const decrpyted = decrypt({ data: ecrypted, iv }, this.table.db.options.encryptionConfig.securityKey);
                const json = JSON.parse(decrpyted);
                const data = new WideColumnarData(json);
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
                const file = reference[stringify(d.primary.value)];
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
        await truncate(transactionPath);
        const rl = readline.createInterface({
            input: createReadStream(fullWriterPath),
            crlfDelay: Infinity,
        });
        let index = 0;
        const datas = [];
        for await (const line of rl) {
            if (index < 2) {
                index++;
                continue;
            }
            const decrypted = decrypt({
                iv: this.#log.ivFull,
                data: line,
            }, this.table.db.options.encryptionConfig.securityKey);
            const [columnValue, columnType, primaryValue, primaryType, method] = decrypted.split(ReferenceConstantSpace);
            const parsedMethod = Number(method.trim());
            const data = new WideColumnarData({
                column: {
                    name: this.name,
                    type: columnType,
                    value: parse(columnValue, columnType),
                },
                primary: {
                    name: this.table.primary.name,
                    type: this.table.primary.type,
                    value: parse(primaryValue, primaryType),
                },
            });
            if (this.memMap.has(data.primary.value)) {
                continue;
            }
            if (parsedMethod === DatabaseMethod.Set) {
                datas.push(data);
            }
            else if (parsedMethod === DatabaseMethod.Delete) {
                const index = datas.findIndex((x) => x.primary.value === data.primary.value);
                if (index !== -1) {
                    datas.splice(index, 1);
                }
            }
        }
        // delete all files
        for (const file of this.files) {
            await unlink(`${this.path}/${file}`);
        }
        this.files = [];
        // divide the datas into chunks
        const chunks = [];
        let i = 0;
        let j = datas.length;
        while (i < j) {
            let bufferSize = "";
            while (bufferSize.length < this.table.db.options.cacheConfig.limit) {
                const encrypted = encrypt(datas[i].toString(), this.table.db.options.encryptionConfig.securityKey);
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
                await writeFile(path, chunk);
                this.files.push(path);
                res();
            });
        }
        await Promise.all(promises);
        // clear the logs
        await this.#createNewLogCycle();
    }
}
//# sourceMappingURL=Column.js.map