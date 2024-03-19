import WideColumnarColumn from "./Column.js";
import { DatabaseEvents } from "../../index.js";
import { existsSync, mkdirSync } from "fs";
export default class WideColumnarTable {
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
            if (!(column instanceof WideColumnarColumn)) {
                const col = new WideColumnarColumn(column);
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
            if (!existsSync(`${this.db.options.dataConfig.path}/${this.name}`)) {
                mkdirSync(`${this.db.options.dataConfig.path}/${this.name}`, { recursive: true });
            }
            if (!existsSync(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}`)) {
                mkdirSync(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}`, { recursive: true });
            }
            if (!existsSync(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}/${column.name}`)) {
                mkdirSync(`${this.db.options.dataConfig.path}/${this.#db.options.dataConfig.referencePath}/${this.name}/${column.name}`, { recursive: true });
            }
            await column.initialize();
        }
        this.#db.emit(DatabaseEvents.TableReady, this);
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
//# sourceMappingURL=Table.js.map