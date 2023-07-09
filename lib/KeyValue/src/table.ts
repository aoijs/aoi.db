import {
    WriteStream,
    appendFileSync,
    createReadStream,
    createWriteStream,
    readdirSync,
    statSync,
} from "fs";
import {
    ReferenceConstantSpace,
    createHash,
    createHashRawString,
    decodeHash,
    decrypt,
    encrypt,
} from "../../utils.js";
import { DatabaseEvents, DatabaseMethod } from "../typings/enum.js";
import {
    KeyValueData,
    KeyValueJSONOption,
    KeyValueTableOptions,
} from "../typings/interface.js";
import Data from "./data.js";
import KeyValue from "./database.js";
import { appendFile, readFile, rename, stat, writeFile } from "fs/promises";
import Referencer from "./referencer.js";
import { Hash } from "../../typings/interface.js";
import { EventEmitter } from "events";

export default class Table extends EventEmitter{
    options: KeyValueTableOptions;
    db: KeyValue;
    paths!: {
        reference: string;
        log: string;
    };
    files!: {
        name: string;
        size: number;
    }[];
    logHash!: string;
    #queue = {
        set: [] as Data[],
        get: {} as Record<string, Record<string, KeyValueJSONOption>>,
    };
    #queued = {
        set: false,
        reference: false,
    };
    #intervals = {
        set: null as NodeJS.Timeout | null,
        delete: null as NodeJS.Timeout | null,
    };
    referencer!: Referencer;
    readyAt!: number;
    constructor(options: KeyValueTableOptions, db: KeyValue) {
        super();
        this.options = options;
        this.db = db;
        this.#initialize();
    }
    async #initialize() {
        this.paths = {
            reference: `${this.db.options.dataConfig.referencePath}/${this.options.name}/reference.log`,
            log: `${this.db.options.fileConfig.transactionLogPath}/${this.options.name}/transaction.log`,
        };
        this.logHash = await this.#getHashLog();
        this.files = readdirSync(
            `${this.db.options.dataConfig.path}/${this.options.name}`,
        ).map((file) => {
            const stats = statSync(
                `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
            );
            return {
                name: file,
                size: stats.size,
            };
        });
        this.referencer = new Referencer(this.paths.reference);
        await this.#checkIntegrity();
        this.readyAt = Date.now();
        this.emit(DatabaseEvents.TableReady, this);
    }

    async #checkIntegrity() {
        const logs = await this.#getLogs();
        const reference = await this.referencer.getReference();
        const lastFlush = logs.findLastIndex(
            (log) => log.method === DatabaseMethod.Flush,
        );

        if (lastFlush === -1 || lastFlush !== logs.length - 1) {
            const dataToAdd = logs.slice(lastFlush + 1);
            for (const data of dataToAdd) {
                if (data.method === DatabaseMethod.Set) {
                    let file = reference[data.key];
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

    async #getHashLog() {
        const logStream = createReadStream(this.paths.log);

        return new Promise<string>((resolve, reject) => {
            let hash = "";
            logStream.on("readable", () => {
                const data = logStream.read(16);
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

        await appendFile(this.paths.log, hash + "\n");
        return;
    }
    async #set() {
        if (!this.#queue.set.length) {
            this.#queued.set = false;
            clearInterval(this.#intervals.set as NodeJS.Timeout);
            this.#intervals.set = null;
            return;
        }
        this.#queued.set = true;
        if (!Object.keys(this.#queue.get).length) {
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
                    this.#queue.get[files.name] = json;
                } else {
                    this.#queue.get[files.name] = Jdata;
                }
            }

            setTimeout(() => {
                this.#queue.get = {};
            }, 60000);
        }

        const fileSetToWrite = new Set<string>(
            this.#queue.set.map((data) => data.file),
        );

        for (const data of this.#queue.set) {
            const file = this.files.find((file) => file.name === data.file);

            if (!file) {
                throw new Error("File not found");
            }

            this.#queue.get[data.file][data.key] = data.toJSON();
        }

        for (const file of fileSetToWrite) {
            const json = this.#queue.get[file];
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

        await this.#wal(Data.emptyData(), DatabaseMethod.Flush);
    }

    #getCurrentFile() {
        return this.files.at(-1)?.name as string;
    }

    async #createNewFile() {
        const newFile = `${this.options.name}_scheme_${this.files.length}${this.db.options.fileConfig.extension}`;

        const newFilePath = `${this.db.options.dataConfig.path}/${this.options.name}/${newFile}`;

        await writeFile(
            newFilePath,
            JSON.stringify(
                encrypt(`{}`, this.db.options.encryptionConfig.securityKey),
            ),
        );

        this.files.push({
            name: newFile,
            size: await this.#fileSize(newFile),
        });

        return newFile;
    }

    async set(key: string, value: Partial<KeyValueData>) {
        const reference = await this.referencer.getReference();
        let data: Data;
        if (reference.hasOwnProperty(key)) {
            const file = reference[key];
            data = new Data({
                file,
                key,
                value: value.value,
                ttl: value.ttl ?? -1,
                type: value.type ?? undefined,
            });
        } else {
            let file = this.#getCurrentFile();
            data = new Data({
                file,
                key,
                value: value.value,
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
        if (reference[data.key] !== data.file) {
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
            }, 1000);
        }
    }

    async #fileSize(file: string) {
        const stats = await stat(
            `${this.db.options.dataConfig.path}/${this.options.name}/${file}`,
        );
        return stats.size;
    }
    async #getLogs() {
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
}
