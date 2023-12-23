"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const index_js_1 = require("../../index.js");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
class GraphDB extends events_1.default {
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
                cache: index_js_1.CacheType.LRU,
                reference: index_js_1.ReferenceType.Cache,
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
            this.removeListener(index_js_1.DatabaseEvents.TableReady, isReady);
            this.emit(index_js_1.DatabaseEvents.Connect);
        };
        this.on(index_js_1.DatabaseEvents.TableReady, isReady);
        if (!(0, fs_1.existsSync)(this.#options.dataConfig.path)) {
            (0, fs_1.mkdirSync)(this.#options.dataConfig.path);
            for (const table of this.#options.dataConfig.tables) {
                (0, fs_1.mkdirSync)(`${this.#options.dataConfig.path}/${table}`, {
                    recursive: true,
                });
                (0, fs_1.writeFileSync)(`${this.#options.dataConfig.path}/${table}/${table}_scheme_1${this.#options.fileConfig.extension}`, JSON.stringify(this.#options.encryptionConfig.encriptData
                    ? (0, index_js_1.encrypt)(`{}`, this.#options.encryptionConfig.securityKey)
                    : {}));
            }
            if (!(0, fs_1.existsSync)(`${this.#options.dataConfig.path}/.backup`)) {
                (0, fs_1.mkdirSync)(`${this.#options.dataConfig.path}/.backup`);
            }
        }
        for (const table of this.#options.dataConfig.tables) {
            if (!(0, fs_1.existsSync)(`${this.#options.dataConfig.path}/${table}`)) {
                (0, fs_1.mkdirSync)(`${this.#options.dataConfig.path}/${table}`);
                (0, fs_1.writeFileSync)(`${this.#options.dataConfig.path}/${table}/${table}_scheme_1${this.#options.fileConfig.extension}`, JSON.stringify(this.#options.encryptionConfig.encriptData
                    ? (0, index_js_1.encrypt)(`{}`, this.#options.encryptionConfig.securityKey)
                    : {}));
            }
        }
        if (!(0, fs_1.existsSync)(this.#options.dataConfig.referencePath)) {
            (0, fs_1.mkdirSync)(this.#options.dataConfig.referencePath);
            for (const table of this.#options.dataConfig.tables) {
                (0, fs_1.mkdirSync)(`${this.#options.dataConfig.referencePath}/${table}`, {
                    recursive: true,
                });
                (0, fs_1.writeFileSync)(`${this.#options.dataConfig.referencePath}/${table}/reference_1.log`, ``);
            }
        }
        if (!(0, fs_1.existsSync)(this.#options.fileConfig.transactionLogPath)) {
            (0, fs_1.mkdirSync)(this.#options.fileConfig.transactionLogPath);
            for (const table of this.#options.dataConfig.tables) {
                (0, fs_1.mkdirSync)(`${this.#options.fileConfig.transactionLogPath}/${table}`, {
                    recursive: true,
                });
                (0, fs_1.writeFileSync)(`${this.#options.fileConfig.transactionLogPath}/${table}/transaction.log`, `${(0, crypto_1.randomBytes)(16).toString("hex")}\n`);
                (0, fs_1.writeFileSync)(`${this.#options.fileConfig.transactionLogPath}/${table}/fullWriter.log`, ``);
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
exports.default = GraphDB;
//# sourceMappingURL=database.js.map