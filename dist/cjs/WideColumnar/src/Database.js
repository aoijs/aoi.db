"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const index_js_1 = require("../../index.js");
const Table_js_1 = __importDefault(require("./Table.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const tar_1 = __importDefault(require("tar"));
class WideColumnar extends events_1.default {
    tables = {};
    #options;
    readyAt = -1;
    constructor(options) {
        super();
        //@ts-ignore
        this.#options = this.#finalizeOptions(options);
    }
    get options() {
        return this.#options;
    }
    static defaultOptions = {
        dataConfig: {
            path: "./database",
            tables: [
                {
                    name: "main",
                    columns: [
                        {
                            name: "id",
                            primaryKey: true,
                            default: "0",
                            type: "string",
                        },
                        {
                            name: "var",
                            primaryKey: false,
                            default: "0",
                            type: "string",
                        },
                    ],
                },
            ],
            referencePath: "./reference",
        },
        cacheConfig: {
            limit: 20 * 1024 * 1024,
            sortFunction: (a, b) => {
                if (a.column && a.column.value && b.column && b.column.value) {
                    return a.column.value > b.column.value ? 1 : -1;
                }
                return 0;
            },
            referenceType: index_js_1.ReferenceType.File,
        },
        encryptionConfig: {
            securityKey: "a-32-characters-long-string-here",
        },
        fileConfig: {
            extension: ".wcd",
        },
        debug: false,
    };
    #finalizeOptions(options) {
        const defaultOptions = WideColumnar.defaultOptions;
        return {
            dataConfig: {
                path: options.dataConfig?.path || defaultOptions.dataConfig.path,
                tables: options.dataConfig?.tables ||
                    defaultOptions.dataConfig.tables,
                referencePath: options.dataConfig?.referencePath ||
                    defaultOptions.dataConfig.referencePath,
            },
            cacheConfig: {
                limit: options.cacheConfig?.limit ||
                    defaultOptions.cacheConfig.limit,
                sortFunction: options.cacheConfig?.sortFunction ||
                    defaultOptions.cacheConfig.sortFunction,
                referenceType: options.cacheConfig?.referenceType ||
                    defaultOptions.cacheConfig.referenceType,
            },
            encryptionConfig: {
                securityKey: options.encryptionConfig?.securityKey ||
                    defaultOptions.encryptionConfig.securityKey,
            },
            fileConfig: {
                extension: options.fileConfig?.extension ||
                    defaultOptions.fileConfig.extension,
            },
            debug: options.debug || defaultOptions.debug,
        };
    }
    async connect() {
        const isReady = (table) => {
            this.tables[table.name].ready = true;
            for (const t of this.#options.dataConfig.tables) {
                if (!this.tables[t.name]?.ready)
                    return;
            }
            this.readyAt = Date.now();
            this.removeListener(index_js_1.DatabaseEvents.TableReady, isReady);
            this.emit(index_js_1.DatabaseEvents.Connect);
        };
        this.on(index_js_1.DatabaseEvents.TableReady, isReady);
        const referencePath = path_1.default.join(this.#options.dataConfig.path, this.#options.dataConfig.referencePath);
        if (!(0, fs_1.existsSync)(referencePath)) {
            (0, fs_1.mkdirSync)(referencePath, { recursive: true });
        }
        const backupPath = path_1.default.join(this.#options.dataConfig.path, ".backup");
        if (!(0, fs_1.existsSync)(backupPath)) {
            (0, fs_1.mkdirSync)(backupPath, { recursive: true });
        }
        for (const table of this.#options.dataConfig.tables) {
            this.tables[table.name] = {
                ready: false,
                table: new Table_js_1.default({
                    name: table.name,
                    columns: table.columns,
                    db: this,
                }),
            };
            await this.tables[table.name].table.connect();
        }
    }
    getTable(name) {
        return this.tables[name].table;
    }
    async set(table, column, primary) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.set(column, primary);
    }
    async get(table, columnName, primary) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.get(columnName, primary);
    }
    async delete(table, columnName, primary) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.delete(columnName, primary);
    }
    async all(table, columnName, query) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.all(columnName, query);
    }
    async allColumns(table, query) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.allColumns(query);
    }
    async allTable(query) {
        const tables = [];
        for (const table of Object.keys(this.tables)) {
            tables.push(...(await this.tables[table].table.allColumns(query)));
        }
        return tables;
    }
    async clear(table) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.clear();
    }
    async clearAll() {
        for (const table of Object.keys(this.tables)) {
            await this.tables[table].table.clear();
        }
    }
    async deleteMany(table, columnName, query) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.deleteMany(columnName, query);
    }
    async findMany(table, columnName, query) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.findMany(columnName, query);
    }
    async findOne(table, columnName, query) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.findOne(columnName, query);
    }
    async has(table, columnName, primary) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.has(columnName, primary);
    }
    async fullRepair(table) {
        const t = this.tables[table];
        if (!t)
            throw new Error(`Table ${table} does not exist`);
        return await t.table.fullRepair();
    }
    backup() {
        const backupPath = `${this.#options.dataConfig.path}/.backup`;
        const backupName = `${backupPath}/Snapshot_${new Date()
            .toISOString()
            .replaceAll(" ", "_")
            .replaceAll(",", "_")
            .replaceAll(":", "_")}.tar.gz`;
        (0, fs_1.writeFileSync)(backupName, "");
        const writer = (0, fs_1.createWriteStream)(backupName);
        tar_1.default.c({
            gzip: true,
        }, [
            this.#options.dataConfig.referencePath,
            ...Object.keys(this.tables).map((table) => {
                return `${this.#options.dataConfig.path}/${table}`;
            }),
        ]).pipe(writer);
    }
}
exports.default = WideColumnar;
//# sourceMappingURL=Database.js.map