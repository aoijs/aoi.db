"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WideColumnTable = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const functions_js_1 = require("../utils/functions.js");
const constants_js_1 = require("./constants.js");
const data_js_1 = require("./data.js");
const error_js_1 = require("./error.js");
const queueManager_js_1 = require("./queueManager.js");
class WideColumnTable {
    name;
    columns;
    queue = new queueManager_js_1.WideColumnQueue();
    primary;
    db;
    reference;
    constructor(name, columns, db) {
        this.name = name;
        this.db = db;
        this.columns = columns.filter((x) => !x.primary);
        const primaryColumn = columns.find((x) => x.primary);
        if (!primaryColumn) {
            throw new error_js_1.WideColumnError("Primary Column Not Provided For Table " + name);
        }
        if (this.db.options.cacheOption.cacheReference === "MEMORY") {
            this.reference = {};
        }
        else {
            this.reference = path_1.default.join(this.db.options.path, this.name, "reference.log");
        }
        this.primary = primaryColumn;
    }
    async connect() {
        if (!(0, fs_1.existsSync)(path_1.default.join(this.db.options.path, this.name))) {
            (0, fs_1.mkdirSync)(path_1.default.join(this.db.options.path, this.name), {
                recursive: true,
            });
        }
        if (typeof this.reference === "string") {
            if (!(0, fs_1.existsSync)(this.reference)) {
                const iv = (0, crypto_1.randomBytes)(16).toString("hex");
                (0, fs_1.writeFileSync)(this.reference, `${iv}\n\n`, {
                    encoding: "utf-8",
                });
            }
        }
        for (const column of this.columns) {
            if (!(0, fs_1.existsSync)(path_1.default.join(this.db.options.path, this.name, column.name))) {
                (0, fs_1.mkdirSync)(path_1.default.join(this.db.options.path, this.name, column.name), {
                    recursive: true,
                });
            }
            column.setTable(this);
            column.setPath(`${this.db.options.path}/${this.name}/${column.name}/`);
            column.setCache();
            column.setFiles();
            await column.loadData();
        }
    }
    async set(secondaryColumnData, primaryColumnData) {
        if (this.primary.name !== primaryColumnData.name) {
            throw new error_js_1.WideColumnError("Primary Column Name Does Not Match");
        }
        const column = this.columns.find((x) => x.name === secondaryColumnData.name);
        if (!column) {
            throw new error_js_1.WideColumnError("Secondary Column Name Does Not Match");
        }
        if (!primaryColumnData.value === undefined)
            primaryColumnData.value = this.primary.default;
        if (!this.primary.matchType(primaryColumnData.value)) {
            throw new error_js_1.WideColumnError("Primary Column Value Does Not Match the Type: " + this.primary.type);
        }
        if (!column.matchType(secondaryColumnData.value)) {
            throw new error_js_1.WideColumnError("Secondary Column Value Does Not Match the Type: " + column.type);
        }
        const data = new data_js_1.WideColumnData({
            primaryColumnName: this.primary.name,
            primaryColumnValue: primaryColumnData.value,
            primaryColumnType: this.primary.type,
            secondaryColumnName: column.name,
            secondaryColumnValue: secondaryColumnData.value,
            secondaryColumnType: column.type,
        });
        await column.set(primaryColumnData.value, data);
    }
    get logPath() {
        return `${this.db.options.path}/${this.name}/transactions.log`;
    }
    async get(column, primary) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        if (primary === null) {
            throw new error_js_1.WideColumnError(`Primary Value Cannot Be Null`);
        }
        const memMap = col.memMap;
        if (!memMap) {
            throw new error_js_1.WideColumnError(`Column ${column} Not In Memory`);
        }
        if (memMap.data.has(primary)) {
            return memMap.data.get(primary)?.secondary.value;
        }
        else if (typeof this.reference === "object") {
            const file = this.reference[column]?.get(primary);
            if (!file) {
                return;
            }
            else {
                const filePath = path_1.default.join(col.path, file);
                const data = await (0, promises_1.readFile)(filePath, "utf8");
                const dataPerLine = data.split("\n");
                const iv = dataPerLine[0].trim();
                let u = 2;
                while (u < dataPerLine.length) {
                    const line = dataPerLine[u];
                    const parsedLine = (0, functions_js_1.decryptColumnFile)(line, iv, this.db.securitykey);
                    const [Primary, Secondary] = parsedLine.split(constants_js_1.spaceConstant);
                    this.queue.addToQueue("get", filePath, Primary, Secondary);
                    if (Primary === (0, functions_js_1.stringify)(primary)) {
                        return Secondary;
                    }
                    u++;
                }
            }
        }
        else {
            const file = await (0, promises_1.readFile)(this.reference, "utf8");
            const dataPerLine = file.split("\n");
            const iv = dataPerLine[0].trim();
            let u = 2;
            while (u < dataPerLine.length) {
                const line = dataPerLine[u];
                const parsedLine = (0, functions_js_1.decryptColumnFile)(line, iv, this.db.securitykey);
                const [colm, primary, file] = parsedLine.split(constants_js_1.spaceConstant);
                if (primary === (0, functions_js_1.stringify)(primary) && column === colm) {
                    const filePath = path_1.default.join(col.path, file);
                    const data = await (0, promises_1.readFile)(filePath, "utf8");
                    const dataPerLine = data.split("\n");
                    const iv = dataPerLine[0].trim();
                    let j = 2;
                    while (j < dataPerLine.length) {
                        const line = dataPerLine[j];
                        const parsedLine = (0, functions_js_1.decryptColumnFile)(line, iv, this.db.securitykey);
                        const [Primary, Secondary] = parsedLine.split(constants_js_1.spaceConstant);
                        this.queue.addToQueue("get", filePath, Primary, Secondary);
                        if (Primary === (0, functions_js_1.stringify)(primary)) {
                            return Secondary;
                        }
                        j++;
                    }
                }
                u++;
            }
        }
        if (!this.queue.queued.get) {
            this.queue.queued.get = true;
            const timeout = setTimeout(async () => {
                this.queue.queue.get.clear();
                this.queue.queued.get = false;
                clearTimeout(timeout);
            }, this.db.options.methodOption.getTime);
        }
    }
    async delete(column, primary) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        if (!col.memMap)
            return;
        if (col.memMap.data.has(primary)) {
            col.updateLogs("delete", (0, functions_js_1.stringify)(primary));
            this.queue.addToQueue("delete", column, primary);
            return await col.delete(primary);
        }
        else if (typeof this.reference === "object") {
            const ref = this.reference[column]?.get(primary);
            if (!ref) {
                return;
            }
            this.reference[column]?.delete(primary);
            col.updateLogs("delete", (0, functions_js_1.stringify)(primary));
            return await col.delete(primary);
        }
        else {
            const refData = await (0, promises_1.readFile)(this.reference, "utf8");
            const refDataPerLine = refData.split("\n");
            const iv = refDataPerLine[0].trim();
            let u = 2;
            while (u < refDataPerLine.length) {
                const line = refDataPerLine[u];
                const parsedLine = (0, functions_js_1.decryptColumnFile)(line, iv, this.db.securitykey);
                const [colm, pri, file] = parsedLine.split(constants_js_1.spaceConstant);
                if (pri === (0, functions_js_1.stringify)(primary) && column === colm) {
                    col.updateLogs("delete", (0, functions_js_1.stringify)(primary));
                    refDataPerLine.splice(u, 1);
                    (0, fs_1.writeFileSync)(this.reference, refDataPerLine.join("\n"), "utf8");
                    return await col.delete(primary);
                }
                u++;
            }
        }
    }
    async all(column, filter, limit = 10) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        if (!col.memMap)
            return;
        const data = col.files.length
            ? (await col.getAllData()).concat(col.memMap)
            : col.memMap;
        if (!filter) {
            return data.slice(0, limit);
        }
        else {
            return data.filter(filter).slice(0, limit);
        }
    }
    get ping() {
        let ping = 0;
        for (const col of this.columns) {
            if (!col.files.length) {
                const start = Date.now();
                col.memMap?.random();
                ping += Date.now() - start;
            }
            else {
                const start = Date.now();
                const file = col.files[Math.floor(Math.random() * col.files.length)];
                const filePath = path_1.default.join(col.path, file);
                (0, fs_1.readFileSync)(filePath, "utf8");
                ping += Date.now() - start;
            }
        }
        return ping / this.columns.length;
    }
    async getAllData(column) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        return (await col.getAllData()).concat(col.memMap);
    }
    async getTransactionLog(column) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        return await col.getTransactionLog();
    }
    async allData() {
        const obj = new Map();
        for (const col of this.columns) {
            const data = (await col.getAllData()).concat(col.memMap);
            for (const d of data.data.values()) {
                const da = obj.get(d.primary.value);
                if (da) {
                    da[col.name] = d.secondary.value;
                    obj.set(d.primary.value, da);
                }
                else {
                    obj.set(d.primary.value, {
                        [this.primary.name]: d.primary.value,
                        [col.name]: d.secondary.value,
                    });
                }
            }
        }
        return [...obj.values()];
    }
    clearColumn(column) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        col.clear();
    }
    clear() {
        for (const col of this.columns) {
            col.clear();
        }
    }
    disconnect() {
        this.db.tables.delete(this.name);
    }
    unloadColumn(column) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new error_js_1.WideColumnError(`Column ${column} Not Found`);
        }
        col.unload();
    }
    async bulkSet(...data) {
        for (const [secondaryColumnData, primaryColumnData] of data) {
            if (this.primary.name !== primaryColumnData.name) {
                throw new error_js_1.WideColumnError("Primary Column Name Does Not Match");
            }
            const column = this.columns.find((x) => x.name === secondaryColumnData.name);
            if (!column) {
                throw new error_js_1.WideColumnError("Secondary Column Name Does Not Match");
            }
            if (!this.primary.matchType(primaryColumnData.value)) {
                throw new error_js_1.WideColumnError("Primary Column Value Does Not Match the Type: " + this.primary.type);
            }
            if (!column.matchType(secondaryColumnData.value)) {
                throw new error_js_1.WideColumnError("Secondary Column Value Does Not Match the Type: " + column.type);
            }
            const data = new data_js_1.WideColumnData({
                primaryColumnName: this.primary.name,
                primaryColumnValue: primaryColumnData.value,
                primaryColumnType: this.primary.type,
                secondaryColumnName: column.name,
                secondaryColumnValue: secondaryColumnData.value,
                secondaryColumnType: column.type,
            });
            await column.set(primaryColumnData.value, data);
        }
    }
}
exports.WideColumnTable = WideColumnTable;
//# sourceMappingURL=table.js.map