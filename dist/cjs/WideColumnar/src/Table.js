"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Column_js_1 = __importDefault(require("./Column.js"));
const index_js_1 = require("../../index.js");
const fs_1 = require("fs");
class WideColumnarTable {
    name;
    columns;
    #db;
    #primary;
    options;
    constructor(options) {
        this.name = options.name;
        this.columns = [];
        this.#parseColumns(options.columns);
        this.#db = options.db;
    }
    #parseColumns(columns) {
        for (const column of columns) {
            if (!(column instanceof Column_js_1.default)) {
                const col = new Column_js_1.default(column);
                col.setTable(this);
                this.columns.push(col);
                if (col.primaryKey) {
                    if (this.#primary) {
                        throw new Error("Multiple primary keys are not allowed");
                    }
                    this.#primary = {
                        name: col.name,
                        type: col.type,
                    };
                }
            }
        }
    }
    get db() {
        return this.#db;
    }
    async connect() {
        for (const column of this.columns) {
            column.setTable(this);
            column.setPath(this.db.options.dataConfig.path + "/" + this.name);
            if (!(0, fs_1.existsSync)(`${this.db.options.dataConfig.path}/${this.name}`)) {
                (0, fs_1.mkdirSync)(`${this.db.options.dataConfig.path}/${this.name}`, { recursive: true });
            }
            if (!(0, fs_1.existsSync)(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}`)) {
                (0, fs_1.mkdirSync)(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}`, { recursive: true });
            }
            if (!(0, fs_1.existsSync)(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}/${column.name}`)) {
                (0, fs_1.mkdirSync)(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}/${column.name}`, { recursive: true });
            }
            await column.initialize();
        }
        this.#db.emit(index_js_1.DatabaseEvents.TableReady, this);
    }
    get primary() {
        return this.#primary;
    }
    async set(column, primary) {
        const col = this.columns.find((c) => c.name === column.name);
        if (!col) {
            throw new Error(`Column ${column.name} does not exist`);
        }
        return await col.set(primary.value, column.value);
    }
    async get(columnName, primary) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.get(primary);
    }
    async delete(columnName, primary) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.delete(primary);
    }
    async all(columnName, query, limit = Infinity) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.all(query, limit);
    }
    async allColumns(query, limit = Infinity) {
        const datas = [];
        for (const column of this.columns) {
            if (column.primaryKey)
                continue;
            const data = await column.all(query, limit);
            datas.push(...data);
        }
        datas.sort(this.db.options.cacheConfig.sortFunction);
        return datas;
    }
    async findMany(columnName, query) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.findMany(query);
    }
    async findOne(columnName, query) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.findOne(query);
    }
    async deleteMany(columnName, query) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.deleteMany(query);
    }
    async has(columnName, primary) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.has(primary);
    }
    async clear() {
        for (const column of this.columns) {
            await column.clear();
        }
    }
    async clearColumn(columnName) {
        const col = this.columns.find((c) => c.name === columnName);
        if (!col) {
            throw new Error(`Column ${columnName} does not exist`);
        }
        return await col.clear();
    }
    async fullRepair() {
        for (const column of this.columns) {
            await column.fullRepair();
        }
    }
}
exports.default = WideColumnarTable;
//# sourceMappingURL=Table.js.map