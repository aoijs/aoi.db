import { KeyValueOptions } from "../typings/interface.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { CacheReferenceType, DatabaseEvents } from "../typings/enum.js";
import { DeepRequired } from "../typings/type.js";
import { encrypt } from "../../utils.js";
import Table from "./table.js";
import { EventEmitter } from "events";
export default class KeyValue extends EventEmitter {
    #options: DeepRequired<KeyValueOptions>;
    tables: Record<string,Table> = {};
    readyAt!: number;
    constructor(options: KeyValueOptions) {
        super();
        this.#options = this.#finalizeOptions(options);
    }
    static defaultOptions(): DeepRequired<KeyValueOptions> {
        return {
            dataConfig: {
                path: "./database",
                tables: ["main"],
                referencePath: "./database/reference/",
            },
            fileConfig: {
                extension: ".sql",
                transactionLogPath: "./database/transaction/",
                maxSize: 20*1024*1024,
            },
            encryptionConfig: {
                securityKey: "a-32-characters-long-string-here",
                encriptData: true,
            },
            cacheConfig: {
                cacheReference: CacheReferenceType.LRU,
                limit: 1000,
                sorted: false,
                sortFunction: (a, b) => {
                    return 0;
                },
            },
        };
    }

    #finalizeOptions(options: KeyValueOptions): DeepRequired<KeyValueOptions> {
        const defaultOptions = KeyValue.defaultOptions();
        const finalOptions: DeepRequired<KeyValueOptions> = {
            dataConfig: {
                path:
                    options?.dataConfig?.path || defaultOptions.dataConfig.path,
                tables:
                    options?.dataConfig?.tables ||
                    defaultOptions.dataConfig.tables,
                referencePath:
                    options?.dataConfig?.referencePath ||
                    defaultOptions.dataConfig.referencePath,
            },
            fileConfig: {
                extension:
                    options?.fileConfig?.extension ||
                    defaultOptions.fileConfig.extension,
                transactionLogPath:
                    options?.fileConfig?.transactionLogPath ||
                    defaultOptions.fileConfig.transactionLogPath,
                maxSize:
                    options?.fileConfig?.maxSize ||
                    defaultOptions.fileConfig.maxSize,
            },
            encryptionConfig: {
                securityKey:
                    options?.encryptionConfig?.securityKey ??
                    defaultOptions.encryptionConfig.securityKey,
                encriptData: options?.encryptionConfig?.encriptData ?? defaultOptions.encryptionConfig.encriptData,
            },
            cacheConfig: {
                cacheReference:
                    options?.cacheConfig?.cacheReference ||
                    defaultOptions.cacheConfig.cacheReference,
                limit:
                    options?.cacheConfig?.limit ||
                    defaultOptions.cacheConfig.limit,
                sorted:
                    options?.cacheConfig?.sorted ||
                    defaultOptions.cacheConfig.sorted,
                sortFunction:
                    options?.cacheConfig?.sortFunction ||
                    defaultOptions.cacheConfig.sortFunction,
            },
        };

        return finalOptions;
    }

    connect() {
 
        
        if (!existsSync(this.#options.dataConfig.path)) {
            mkdirSync(this.#options.dataConfig.path);
            for (const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.dataConfig.path}/${table}`,{
                    recursive:true
                });
                writeFileSync(
                    `${this.#options.dataConfig.path}/${table}/${table}_scheme_1${
                        this.#options.fileConfig.extension
                    }`,
                    JSON.stringify(
                        encrypt(
                            `{}`,
                            this.#options.encryptionConfig.securityKey,
                        ),
                    ),
                );
            }
        }
        if (!existsSync(this.#options.dataConfig.referencePath)) {
            mkdirSync(this.#options.dataConfig.referencePath);
            for(const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.dataConfig.referencePath}/${table}`,{
                    recursive:true
                });
                writeFileSync(
                    `${this.#options.dataConfig.referencePath}/${table}/reference.log`,
                    ``,
                );

            }
        }
        if (!existsSync(this.#options.fileConfig.transactionLogPath)) {
            mkdirSync(this.#options.fileConfig.transactionLogPath);
            
            for(const table of this.#options.dataConfig.tables) {
                mkdirSync(`${this.#options.fileConfig.transactionLogPath}/${table}`,{
                    recursive:true
                });
                writeFileSync(
                    `${this.#options.fileConfig.transactionLogPath}/${table}/transaction.log`,
                    `${randomBytes(16).toString("hex")}
`,
                );

            }
        }

        for (const table of this.#options.dataConfig.tables) {
            const t = new Table({
                name: table,
            },this);
            this.tables[table] = t;
        }

        this.readyAt = Date.now();
        this.emit(DatabaseEvents.Connect);
    }
    get options() {
        return this.#options;
    }

}
