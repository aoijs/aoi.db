import {
    WriteStream,
    appendFileSync,
    createReadStream,
    createWriteStream,
    readFileSync,
    readdirSync,
    statSync,
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
} from "../../utils.js";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import {
    KeyValueData,
    KeyValueJSONOption,
    KeyValueTableOptions,
} from "../typings/interface.js";
import Data from "./data.js";
import KeyValue from "./database.js";
import {
    appendFile,
    readFile,
    rename,
    stat,
    truncate,
    unlink,
    writeFile,
} from "fs/promises";
import Referencer from "./referencer.js";
import { Hash } from "../../typings/interface.js";
import { EventEmitter } from "events";
import Cacher from "./cache.js";

export default class Table extends EventEmitter {
    options: KeyValueTableOptions;
    db: KeyValue;
    paths!: {
        reference: string;
        log: string;
    };
    files!: {
        name: string;
        size: number;
        writer: WriteStream;
    }[];
    logHash!: string;
    #queue = {
        set: [] as Data[],
        delete: {} as Record<string, Record<string, any>>,
    };
    #cache: Cacher;
    #queued = {
        set: false,
        reference: false,
        delete: false,
    };
    #intervals = {
        set: null as NodeJS.Timeout | null,
        delete: null as NodeJS.Timeout | null,
    };
    referencer!: Referencer;
    readyAt!: number;
    logData!: {
        writer: WriteStream;
        size: number;
        fullWriter: WriteStream;
    };

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
    constructor(options: KeyValueTableOptions, db: KeyValue) {
        super();
        this.options = options;
        this.#cache = new Cacher(db.options.cacheConfig);
        this.db = db;
        this.#initialize();
    }
    /**
     * @private
     * @description Initializes the table
     */
    async #initialize() {
        this.paths = {
            reference: `${this.db.options.dataConfig.referencePath}/${this.options.name}`,
            log: `${this.db.options.fileConfig.transactionLogPath}/${this.options.name}/transaction.log`,
        };
        this.logHash = await this.#getHashLog();
        this.files = readdirSync(
            `${this.db.options.dataConfig.path}/${this.options.name}`,
        ).map((file) => {
            const stats = statSync(
                `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
            );
            const writer = createWriteStream(
                `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`,
            );

            return {
                name: file,
                size: stats.size,
                writer,
            };
        });
        this.referencer = new Referencer(
            this.paths.reference,
            this.db.options.fileConfig.maxSize,
            this.db.options.cacheConfig.reference,
        );
        this.logData = {
            writer: createWriteStream(this.paths.log, {
                flags: "a",
            }),
            size: statSync(this.paths.log).size,
            fullWriter: createWriteStream(
                this.db.options.fileConfig.transactionLogPath +
                    `/${this.options.name}/fullWriter.log`,
                {
                    flags: "a",
                },
            ),
        };
        this.#checkIntegrity();
        await this.#syncWithLogs();
        this.readyAt = Date.now();
        this.db.emit(DatabaseEvents.TableReady, this);
    }

    /**
     * @private
     * @description Checks the integrity of the table and does a small self repair if needed
     */

    #checkIntegrity() {
        const files = this.files.map((x) => x.name);

        for (const file of files) {
            const data = readFileSync(
                `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
                "utf-8",
            );

            const { data: json, isBroken } = JSONParser(data);

            if (isBroken) {
                console.warn(
                    `Attempting self fix on file ${file} in table ${this.options.name}.`,
                );
                if (this.db.options.encryptionConfig.encriptData) {
                    const decrypted = decrypt(
                        json as Hash,
                        this.db.options.encryptionConfig.securityKey,
                    );
                    const { data: parsed, isBroken } = JSONParser(decrypted);
                    if (isBroken) {
                        writeFileSync(
                            `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
                            JSON.stringify(
                                encrypt(
                                    JSON.stringify(parsed),
                                    this.db.options.encryptionConfig
                                        .securityKey,
                                ),
                            ),
                        );

                        console.warn(
                            `Attempted self fix on file ${file} in table ${this.options.name}. If the file is still corrupted, please use the <KeyValue>.fullRepair("tableName") to restore the data.`,
                        );
                    }
                } else {
                    writeFileSync(
                        `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
                        JSON.stringify(json),
                    );

                    console.warn(
                        `Attempted self fix on file ${file} in table ${this.options.name}. If the file is still corrupted, please use the <KeyValue>.fullRepair("tableName") to restore the data.`,
                    );
                }
            }
        }
    }

    /**
     * @private
     * @description Syncs the table with the transaction log
     */

    async #syncWithLogs() {
        const logs = await this.getLogs();
        const reference = await this.referencer.getReference();
        const lastFlush = logs.findLastIndex(
            (log) => log.method === DatabaseMethod.Flush,
        );

        if (lastFlush !== -1 || lastFlush !== logs.length - 1) {
            const dataToAdd = logs.slice(lastFlush + 1);
            for (const data of dataToAdd) {
                if (data.method === DatabaseMethod.Set) {
                    let file = reference[data.key].file;
                    if (!file) return;
                    else {
                        this.#queue.set.push(
                            new Data({
                                file,
                                key: data.key,
                                value: data.value as string,
                                type: data.type,
                                ttl: data.ttl,
                            }),
                        );
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
        const logStream = createReadStream(this.paths.log);

        return new Promise<string>((resolve, reject) => {
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

    async #wal(data: Data, method: DatabaseMethod) {
        const json = data.toJSON();
        const { key, type, ttl, value } = json;

        const delimitedString = createHashRawString([
            key,
            (value ?? "null")?.toString(),
            type,
            ttl?.toString(),
            method?.toString(),
        ]);

        const hash = createHash(
            delimitedString,
            this.db.options.encryptionConfig.securityKey,
            this.logHash,
        );
        const hashSize = Buffer.byteLength(hash + "\n", "utf-8");
        this.logData.writer.write(`${hash}\n`, () => {
            this.logData.size += hashSize;
        });
        this.logData.fullWriter.write(`${delimitedString}\n`);

        if (method === DatabaseMethod.Flush) {
            if (this.logData.size > this.db.options.fileConfig.maxSize) {
                await truncate(this.paths.log, 33);
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
        if (!this.#queue.set.length) {
            this.#queued.set = false;
            clearInterval(this.#intervals.set as NodeJS.Timeout);
            this.#intervals.set = null;
            return;
        }
        this.#queued.set = true;
        if (this.#cache.size === -1) {
            for (const files of this.files) {
                const Jdata = JSON.parse(
                    (
                        await readFile(
                            `${this.db.options.dataConfig.path}/${this.options.name}/${files.name}`,
                        )
                    ).toString(),
                );

                if (this.db.options.encryptionConfig.encriptData) {
                    const decrypted = decrypt(
                        Jdata as Hash,
                        this.db.options.encryptionConfig.securityKey,
                    );
                    const json = JSON.parse(decrypted);
                    this.#cache.replace(files.name, json);
                } else {
                    this.#cache.replace(files.name, Jdata);
                }
            }

            setTimeout(() => {
                this.#cache.clearAll();
                this.#cache.size = -1;
            }, 60000);
        }

        const fileSetToWrite = new Set(
            this.#queue.set.map((data) => {
                return this.files.find((file) => file.name === data.file);
            }),
        ) as Set<{ name: string; size: number; writer: WriteStream }>;

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
                const encrypted = encrypt(
                    JSON.stringify(json),
                    this.db.options.encryptionConfig.securityKey,
                );

                // file.writer.write(JSON.stringify(encrypted),async() =>{
                //     await rename(
                //         `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                //         `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                //     );
                // });

                await writeFile(
                    `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                    JSON.stringify(encrypted),
                );
            } else {
                file.writer.write(JSON.stringify(json), async () => {
                    await rename(
                        `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                        `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                    );
                });

                await writeFile(
                    `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                    JSON.stringify(json),
                );
            }
            try {
                await rename(
                    `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file.name}`,
                    `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                );
            } catch {}
        }
        this.#queue.set = [];
        await this.#wal(Data.emptyData(), DatabaseMethod.Flush);
    }

    /**
     * @description Gets the current file
     * @returns The current file
     */

    #getCurrentFile() {
        return this.files.at(-1)?.name as string;
    }

    /**
     * @private
     * @description Creates a new file
     * @returns The name of the new file
     */

    async #createNewFile() {
        const newFile = `${this.options.name}_scheme_${this.files.length}${this.db.options.fileConfig.extension}`;

        const newFilePath = `${this.db.options.dataConfig.path}/${this.options.name}/${newFile}`;

        await writeFile(
            newFilePath,
            JSON.stringify(
                encrypt(`{}`, this.db.options.encryptionConfig.securityKey),
            ),
        );

        const writer = createWriteStream(
            `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${newFile}`,
        );

        this.files.push({
            name: newFile,
            size: await this.#fileSize(newFile),
            writer,
        });

        await this.#wal(
            new Data({
                file: newFile,
                key: "",
                value: null,
                ttl: -1,
                type: "",
            }),
            DatabaseMethod.NewFile,
        );

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

    async set(key: string, value: Partial<KeyValueData>) {
        const reference = await this.referencer.getReference();
        let data: Data;
        if (reference.hasOwnProperty(key)) {
            const file = reference[key].file;
            data = new Data({
                file,
                key,
                value: value.value as any,
                ttl: value.ttl ?? -1,
                type: value.type ?? undefined,
            });
        } else {
            let file = this.#getCurrentFile();
            data = new Data({
                file,
                key,
                value: value.value as any,
                ttl: value.ttl ?? -1,
                type: value.type ?? undefined,
            });
        }

        const jsonSize = data.size;
        const fileSize = this.files.find((file) => file.name === data.file)
            ?.size as number;

        if (fileSize + jsonSize > this.db.options.fileConfig.maxSize) {
            data.file = await this.#createNewFile();
        }
        if (reference[data.key]?.file !== data.file) {
            this.referencer.setReference(data.key, data.file);
        }
        this.#queue.set.push(data);
        await this.#wal(data, DatabaseMethod.Set);

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

    async #fileSize(file: string) {
        const stats = await stat(
            `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
        );
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
        const logs = await readFile(this.paths.log);
        const arr = logs.toString().trim().split("\n").slice(2);
        const block = [] as {
            key: string;
            value: string | null;
            type: string;
            ttl: number;
            method: DatabaseMethod;
        }[];
        for (const log of arr) {
            const [key, value, type, ttl, method] = decodeHash(
                log,
                this.db.options.encryptionConfig.securityKey,
                this.logHash,
            );
            block.push({
                key,
                value: value === "null" ? null : value,
                type,
                ttl: ttl === "-1" ? -1 : Number(ttl),
                method: Number(method) as DatabaseMethod,
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

    async get(key: string) {
        const reference = await this.referencer.getReference();
        if (!reference[key]) return null;

        const file = reference[key].file;
        const data = this.#cache.get(key, file);
        if (data) {
            return new Data({
                file,
                key,
                value: data.value,
                ttl: data.ttl,
                type: data.type,
            });
        }

        const d = (await this.#get(key, file)) as KeyValueJSONOption;
        return new Data({
            file,
            key,
            value: d.value,
            ttl: d.ttl,
            type: d.type,
        });
    }

    /**
     * @private
     * @param key key of the data
     * @param file file where the data is stored
     * @returns
     */

    async #get(key: string, file: string) {
        const data = await readFile(
            `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
            "utf-8",
        );

        if (this.db.options.encryptionConfig.encriptData) {
            const decrypted = decrypt(
                JSON.parse(data) as Hash,
                this.db.options.encryptionConfig.securityKey,
            );
            const json = JSON.parse(decrypted);
            this.#cache.replace(file, json);
        } else {
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

    async delete(key: string) {
        const reference = await this.referencer.getReference();
        if (!reference[key]) return null;
        const file = reference[key].file;
        return await this.#delete(key, file);
    }

    /**
     * @private
     * @param key The key of the data
     * @param file The file where the data is stored
     * @returns
     */

    async #delete(key: string, file: string) {
        const path = `${this.db.options.dataConfig.path}/${this.options.name}/${file}`;
        let data: Data | undefined = undefined;
        if (this.#cache.data[file]?.size) {
            const c = this.#cache.get(key, file) as KeyValueJSONOption;
            data = new Data({
                file,
                key,
                value: c?.value,
                ttl: c?.ttl,
                type: c?.type,
            });
            this.#cache.delete(key, file);
        }

        if (!data) {
            const p = await readFile(path, "utf-8");
            const json = JSON.parse(p);
            if (this.db.options.encryptionConfig.encriptData) {
                const decrypted = decrypt(
                    json as Hash,
                    this.db.options.encryptionConfig.securityKey,
                );
                const parsed = JSON.parse(decrypted);
                this.#cache.replace(file, parsed);
            } else {
                this.#cache.replace(file, json);
            }

            const c = this.#cache.get(key, file) as KeyValueJSONOption;
            data = new Data({
                file,
                key,
                value: c?.value,
                ttl: c?.ttl,
                type: c?.type,
            });
        }

        this.#cache.delete(key, file);

        await this.#wal(data as Data, DatabaseMethod.Delete);
        await this.referencer.deleteReference(key);

        if (!this.queue.delete[file]) {
            this.#queue.delete[file] = {};
            this.#queue.delete[file] = this.#cache.toJSON(file);
        } else {
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
            clearInterval(this.#intervals.delete as NodeJS.Timeout);
            this.#intervals.delete = null;
            return;
        }

        for (const file of Object.keys(this.#queue.delete)) {
            const json = this.#queue.delete[file];

            if (this.db.options.encryptionConfig.encriptData) {
                const encrypted = encrypt(
                    JSON.stringify(json),
                    this.db.options.encryptionConfig.securityKey,
                );

                await writeFile(
                    `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`,
                    JSON.stringify(encrypted),
                );
            } else {
                await writeFile(
                    `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`,
                    JSON.stringify(json),
                );
            }

            await rename(
                `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`,
                `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
            );
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
        this.#cache.clearAll();
        await truncate(this.paths.log, 33);
        for (const file of this.files) {
            if (file.name !== this.files[0].name) {
                file.writer.close();
                await unlink(
                    `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                );
            } else {
                await writeFile(
                    `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                    JSON.stringify(
                        this.db.options.encryptionConfig.encriptData
                            ? encrypt(
                                  JSON.stringify({}),
                                  this.db.options.encryptionConfig.securityKey,
                              )
                            : {},
                    ),
                );
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

    async has(key: string) {
        const reference = await this.referencer.getReference();
        if (!reference[key]) return false;
        return true;
    }

    /**
     * @description Fetches the file
     * @param file The file to fetch
     * @returns The file
     * @private
     */

    async #fetchFile(file: string) {
        const data = await readFile(
            `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
            "utf-8",
        );
        let json: Record<string, KeyValueJSONOption> = {};
        if (this.db.options.encryptionConfig.encriptData) {
            const decrypted = decrypt(
                JSON.parse(data) as Hash,
                this.db.options.encryptionConfig.securityKey,
            );
            json = JSON.parse(decrypted);
        } else {
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

    async findOne(query: (value: Data, index: number) => boolean) {
        const files = this.files.map((file) => file.name);

        for (const file of files) {
            let json:
                | Map<string, KeyValueJSONOption>
                | Record<string, KeyValueJSONOption> =
                this.#cache.getFileCache(file);
            if (json) {
                let index = 0;
                for (const values of json.values()) {
                    const data = new Data({
                        file,
                        key: values.key,
                        value: values.value,
                        ttl: values.ttl,
                        type: values.type,
                    });
                    if (query(data, index++)) {
                        return data;
                    }
                }
            } else {
                json = await this.#fetchFile(file);
                this.#cache.replace(file, json);
                let index = 0;
                for (const values of Object.values(json)) {
                    const data = new Data({
                        file,
                        key: values.key,
                        value: values.value,
                        ttl: values.ttl,
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

    async findMany(query: (value: Data, index: number) => boolean) {
        const files = this.files.map((file) => file.name);
        const data = [] as Data[];
        for (const file of files) {
            let json:
                | Map<string, KeyValueJSONOption>
                | Record<string, KeyValueJSONOption> =
                this.#cache.getFileCache(file);
            if (json) {
                let index = 0;
                for (const values of json.values()) {
                    const d = new Data({
                        file,
                        key: values.key,
                        value: values.value,
                        ttl: values.ttl,
                        type: values.type,
                    });
                    if (query(d, index++)) {
                        data.push(d);
                    }
                }
            } else {
                json = await this.#fetchFile(file);
                this.#cache.replace(file, json);
                let index = 0;
                for (const values of Object.values(json)) {
                    const d = new Data({
                        file,
                        key: values.key,
                        value: values.value,
                        ttl: values.ttl,
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

    async all(query?: (value: Data, index: number) => boolean, limit?: number) {
        const allData = await this.findMany(query ?? (() => true));
        if (limit) return allData.slice(0, limit);
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
        for (const file of this.files) {
            file.writer.close();

            if (
                file.name !==
                `${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`
            ) {
                await unlink(
                    `${this.db.options.dataConfig.path}/${this.options.name}/${file.name}`,
                );
            }
        }
        await this.referencer.clear();
        this.logData.writer.close();
        await truncate(this.paths.log, 33);

        await truncate(
            `${this.db.options.dataConfig.path}/${this.options.name}/${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`,
            0,
        );

        const mainObj: Record<string, Record<string, KeyValueJSONOption>> = {
            [`${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`]:
                {},
        };
        let currentFile = `${this.options.name}_scheme_1${this.db.options.fileConfig.extension}`;
        let fileNum = 1;
        const fullLogReader = createReadStream(
            `${this.db.options.fileConfig.transactionLogPath}/${this.options.name}/fullWriter.log`,
        );

        // read logger line by line
        let line = "";
        let buffer = "";
        await new Promise<void>((resolve, reject) => {
            fullLogReader.on("readable", () => {
                buffer += fullLogReader.read();
                const lines = buffer.split("\n");
                buffer = lines.pop() as string;
                for (const line of lines) {
                    const [key, value, type, ttl, method] = line.split(
                        ReferenceConstantSpace,
                    );

                    if (method === DatabaseMethod.Set.toString()) {
                        const data = {
                            key,
                            value,
                            type,
                            ttl: Number(ttl),
                        };

                        mainObj[currentFile][key] = data;
                    }
                    if (method === DatabaseMethod.NewFile.toString()) {
                        currentFile = `${this.options.name}_scheme_${fileNum}${this.db.options.fileConfig.extension}`;
                        fileNum++;
                        mainObj[currentFile] = {};
                    }
                    if (method === DatabaseMethod.Delete.toString()) {
                        delete mainObj[currentFile][key];
                    }
                }
            });

            fullLogReader.on("close", async () => {
                for (const file of Object.keys(mainObj)) {
                    await writeFile(
                        `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
                        JSON.stringify(
                            this.db.options.encryptionConfig.encriptData
                                ? encrypt(
                                      JSON.stringify(mainObj[file]),
                                      this.db.options.encryptionConfig
                                          .securityKey,
                                  )
                                : mainObj[file],
                        ),
                    );
                }

                resolve();
            });
            fullLogReader.on("error", (err) => {
                reject(err);
            });
        });

        this.files = readdirSync(
            `${this.db.options.dataConfig.path}/${this.options.name}`,
        ).map((file) => {
            const stats = statSync(
                `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
            );
            const writer = createWriteStream(
                `${this.db.options.dataConfig.path}/${this.options.name}/$temp_${file}`,
            );

            return {
                name: file,
                size: stats.size,
                writer,
            };
        });

        this.logData.writer = createWriteStream(this.paths.log, {
            flags: "a",
        });

        this.logData.size = statSync(this.paths.log).size;

        const keyFileList = Object.entries(mainObj).map(([file, data]) => {
            return {
                string: `${data.key}${ReferenceConstantSpace}${file}`,
                size: Buffer.byteLength(
                    `${data.key}${ReferenceConstantSpace}${file}`,
                ),
            };
        });

        // split the keyFiles according to the max size

        const keyFileParts = [[]] as { string: string; size: number }[][];

        let currentPart = 0;
        let currentSize = 0;

        for (const kf of keyFileList) {
            if (currentSize + kf.size > this.db.options.fileConfig.maxSize) {
                currentPart += 1;
                currentSize = 0;

                keyFileParts[currentPart] = [kf];
            } else {
                keyFileParts[currentPart].push(kf);
            }
        }

        let currentRefFile = "reference_1.log";
        let refFileNum = 1;

        for (const part of keyFileParts) {
            const data = part.map((x) => x.string).join("\n");

            await writeFile(
                `${this.db.options.dataConfig.referencePath}/${this.options.name}/${currentRefFile}`,
                data,
            );

            refFileNum += 1;
            currentRefFile = `reference_${refFileNum}.log`;
        }

        this.referencer.restart();
        this.repairMode = false;
        return true;
    }
}
