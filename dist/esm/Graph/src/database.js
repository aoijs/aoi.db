import EventEmitter from "events";
import { CacheType, DatabaseEvents, ReferenceType, encrypt } from "../../index.js";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
export default class GraphDB extends EventEmitter {
    #options;
    tables = {};
    readyAt;
    constructor(options) {
        super();
        this.#options = this.#finalizeOptions(options);
    }
    static defaultOptions() {
        return {
            dataConfig: {
                path: "./database",
                tables: ["main"],
                referencePath: "./reference/",
            },
            fileConfig: {
                extension: ".sql",
                transactionLogPath: "./transaction/",
                maxSize: 20 * 1024 * 1024,
            },
            encryptionConfig: {
                securityKey: "a-32-characters-long-string-here",
                encriptData: false,
            },
            cacheConfig: {
                cache: CacheType.LRU,
                reference: ReferenceType.Cache,
                limit: 1000,
                sorted: false,
                sortFunction: (a, b) => {
                    return 0;
                },
            },
        };
    }
    #finalizeOptions(options, defaultOptions = GraphDB.defaultOptions()) {
        const finalOptions = {};
        for (const key in defaultOptions) {
            const k = key;
            if (!options[k]) {
                //@ts-ignore
                finalOptions[k] = defaultOptions[k];
            }
            else {
                if (typeof defaultOptions[k] === "object") {
                    //@ts-ignore
                    finalOptions[k] = this.#finalizeOptions(
                    //@ts-ignore
                    options[k], defaultOptions[k]);
                }
                else {
                    //@ts-ignore
                    finalOptions[k] = options[k];
                }
            }
        }
        return finalOptions;
    }
    get options() {
        return this.#options;
    }
    async connect() {
        const isReady = (table) => {
            // this.tables[table.options.name].ready = true;
            for (const t of this.options.dataConfig.tables) {
                if (!this.tables[t]?.ready)
                    return;
            }
            this.readyAt = Date.now();
            this.removeListener(DatabaseEvents.TableReady, isReady);
            this.emit(DatabaseEvents.Connect);
        };
        this.on(DatabaseEvents.TableReady, isReady);
        if (!existsSync(this.#options.dataConfig.path)) {
            mkdirSync(this.#options.dataConfig.path);
            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.dataConfig.path}/${table}`, {
                    recursive: true,
                });
                writeFileSync(`${this.#options.dataConfig.path}/${table}/${table}_scheme_1${this.#options.fileConfig.extension}`, JSON.stringify(this.#options.encryptionConfig.encriptData
                    ? encrypt(`{}`, this.#options.encryptionConfig.securityKey)
                    : {}));
            }
            if (!existsSync(`${this.#options.dataConfig.path}/.backup`)) {
                mkdirSync(`${this.#options.dataConfig.path}/.backup`);
            }
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!existsSync(`${this.#options.dataConfig.path}/${table}`)) {
                mkdirSync(`${this.#options.dataConfig.path}/${table}`);
                writeFileSync(`${this.#options.dataConfig.path}/${table}/${table}_scheme_1${this.#options.fileConfig.extension}`, JSON.stringify(this.#options.encryptionConfig.encriptData
                    ? encrypt(`{}`, this.#options.encryptionConfig.securityKey)
                    : {}));
            }
        }
        if (!existsSync(this.#options.dataConfig.referencePath)) {
            mkdirSync(this.#options.dataConfig.referencePath);
            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.dataConfig.referencePath}/${table}`, {
                    recursive: true,
                });
                writeFileSync(`${this.#options.dataConfig.referencePath}/${table}/reference_1.log`, ``);
            }
        }
        if (!existsSync(this.#options.fileConfig.transactionLogPath)) {
            mkdirSync(this.#options.fileConfig.transactionLogPath);
            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.fileConfig.transactionLogPath}/${table}`, {
                    recursive: true,
                });
                writeFileSync(`${this.#options.fileConfig.transactionLogPath}/${table}/transaction.log`, `${randomBytes(16).toString("hex")}\n`);
                writeFileSync(`${this.#options.fileConfig.transactionLogPath}/${table}/fullWriter.log`, ``);
            }
        }
        for (const table of this.#options.dataConfig.tables) {
            // const t = new Table(
            //     {
            //         name: table,
            //     },
            //     this,
            // );
            // this.tables[table] = {
            //     table: t,
            //     ready: false,
            // };
            // await t.initialize();
        }
    }
}
//# sourceMappingURL=database.js.map