"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WideColumn = void 0;
const fs_1 = require("fs");
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const enums_js_1 = require("../typings/enums.js");
const error_js_1 = require("./error.js");
const table_js_1 = require("./table.js");
class WideColumn extends tiny_typed_emitter_1.TypedEmitter {
    tables = new Map();
    options;
    constructor(options) {
        super();
        this.options = this._resolve(options);
    }
    _resolve(options) {
        if (!options.encryptOption?.securitykey) {
            throw new error_js_1.WideColumnError("DB#encryptOption.securitykey is required.");
        }
        return {
            cacheOption: {
                cacheReference: options.cacheOption?.cacheReference ?? "MEMORY",
                limit: options.cacheOption?.limit ?? 5000,
                sorted: options.cacheOption?.sorted ?? true,
            },
            extension: options.extension ?? ".sql",
            methodOption: {
                getTime: options.methodOption?.getTime ?? 5000,
                deleteTime: options.methodOption?.deleteTime ?? 100,
            },
            path: options.path ?? "./database",
            storeOption: {
                maxDataPerFile: options.storeOption?.maxDataPerFile ?? 200,
            },
            tables: options.tables ?? [],
            encryptOption: {
                securitykey: options.encryptOption?.securitykey,
            },
        };
    }
    get securitykey() {
        return this.options.encryptOption.securitykey;
    }
    connect() {
        if (!(0, fs_1.existsSync)(this.options.path))
            (0, fs_1.mkdirSync)(this.options.path, { recursive: true });
        for (const table of this.options.tables) {
            const newTable = new table_js_1.WideColumnTable(table.name, table.columns, this);
            newTable.connect();
            this.tables.set(table.name, newTable);
        }
        this.emit(enums_js_1.DatabaseEvents.READY);
    }
    async set(table, columnData, primaryColumnData) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        await tableObj.set(columnData, primaryColumnData);
    }
    async get(table, column, primary) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        return await tableObj.get(column, primary);
    }
    async delete(table, column, primary) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        await tableObj.delete(column, primary);
    }
    async all(table, column, filter, limit = 10) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        return await tableObj.all(column, filter, limit);
    }
    async getAllData(table, column) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        return await tableObj.getAllData(column);
    }
    get ping() {
        let ping = 0;
        for (const table of this.tables.values()) {
            ping += Number(table.ping);
        }
        return ping / this.tables.size;
    }
    tablePing(table) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        return tableObj.ping;
    }
    async getTransactionLog(table, column) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        return await tableObj.getTransactionLog(column);
    }
    async allData(table) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        return await tableObj.allData();
    }
    clearTable(table) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        tableObj.clear();
    }
    clearColumn(table, column) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        tableObj.clearColumn(column);
    }
    clear() {
        for (const table of this.tables.values()) {
            table.clear();
        }
    }
    disconnect() {
        for (const table of this.tables.values()) {
            table.disconnect();
        }
    }
    async bulkSet(table, ...data) {
        const tableObj = this.tables.get(table);
        if (!tableObj)
            throw new error_js_1.WideColumnError(`Table ${table} not found`);
        await tableObj.bulkSet(...data);
    }
}
exports.WideColumn = WideColumn;
//# sourceMappingURL=database.js.map