import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { decryptColumnFile, stringify } from "../utils/functions.js";
import { spaceConstant } from "./constants.js";
import { WideColumnData } from "./data.js";
import { WideColumnError } from "./error.js";
import { WideColumnQueue as Queue } from "./queueManager.js";
export class WideColumnTable {
    name;
    columns;
    queue = new Queue();
    primary;
    db;
    reference;
    constructor(name, columns, db) {
        this.name = name;
        this.db = db;
        this.columns = columns.filter((x) => !x.primary);
        const primaryColumn = columns.find((x) => x.primary);
        if (!primaryColumn) {
            throw new WideColumnError("Primary Column Not Provided For Table " + name);
        }
        if (this.db.options.cacheOption.cacheReference === "MEMORY") {
            this.reference = {};
        }
        else {
            this.reference = path.join(this.db.options.path, this.name, "reference.log");
        }
        this.primary = primaryColumn;
    }
    async connect() {
        if (!existsSync(path.join(this.db.options.path, this.name))) {
            mkdirSync(path.join(this.db.options.path, this.name), {
                recursive: true,
            });
        }
        if (typeof this.reference === "string") {
            if (!existsSync(this.reference)) {
                const iv = randomBytes(16).toString("hex");
                writeFileSync(this.reference, `${iv}\n\n`, {
                    encoding: "utf-8",
                });
            }
        }
        for (const column of this.columns) {
            if (!existsSync(path.join(this.db.options.path, this.name, column.name))) {
                mkdirSync(path.join(this.db.options.path, this.name, column.name), {
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
            throw new WideColumnError("Primary Column Name Does Not Match");
        }
        const column = this.columns.find((x) => x.name === secondaryColumnData.name);
        if (!column) {
            throw new WideColumnError("Secondary Column Name Does Not Match");
        }
        if (!primaryColumnData.value === undefined)
            primaryColumnData.value = this.primary.default;
        if (!this.primary.matchType(primaryColumnData.value)) {
            throw new WideColumnError("Primary Column Value Does Not Match the Type: " + this.primary.type);
        }
        if (!column.matchType(secondaryColumnData.value)) {
            throw new WideColumnError("Secondary Column Value Does Not Match the Type: " + column.type);
        }
        const data = new WideColumnData({
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
            throw new WideColumnError(`Column ${column} Not Found`);
        }
        if (primary === null) {
            throw new WideColumnError(`Primary Value Cannot Be Null`);
        }
        const memMap = col.memMap;
        if (!memMap) {
            throw new WideColumnError(`Column ${column} Not In Memory`);
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
                const filePath = path.join(col.path, file);
                const data = await readFile(filePath, "utf8");
                const dataPerLine = data.split("\n");
                const iv = dataPerLine[0].trim();
                let u = 2;
                while (u < dataPerLine.length) {
                    const line = dataPerLine[u];
                    const parsedLine = decryptColumnFile(line, iv, this.db.securitykey);
                    const [Primary, Secondary] = parsedLine.split(spaceConstant);
                    this.queue.addToQueue("get", filePath, Primary, Secondary);
                    if (Primary === stringify(primary)) {
                        return Secondary;
                    }
                    u++;
                }
            }
        }
        else {
            const file = await readFile(this.reference, "utf8");
            const dataPerLine = file.split("\n");
            const iv = dataPerLine[0].trim();
            let u = 2;
            while (u < dataPerLine.length) {
                const line = dataPerLine[u];
                const parsedLine = decryptColumnFile(line, iv, this.db.securitykey);
                const [colm, primary, file] = parsedLine.split(spaceConstant);
                if (primary === stringify(primary) && column === colm) {
                    const filePath = path.join(col.path, file);
                    const data = await readFile(filePath, "utf8");
                    const dataPerLine = data.split("\n");
                    const iv = dataPerLine[0].trim();
                    let j = 2;
                    while (j < dataPerLine.length) {
                        const line = dataPerLine[j];
                        const parsedLine = decryptColumnFile(line, iv, this.db.securitykey);
                        const [Primary, Secondary] = parsedLine.split(spaceConstant);
                        this.queue.addToQueue("get", filePath, Primary, Secondary);
                        if (Primary === stringify(primary)) {
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
            throw new WideColumnError(`Column ${column} Not Found`);
        }
        if (!col.memMap)
            return;
        if (col.memMap.data.has(primary)) {
            col.updateLogs("delete", stringify(primary));
            this.queue.addToQueue("delete", column, primary);
            return await col.delete(primary);
        }
        else if (typeof this.reference === "object") {
            const ref = this.reference[column]?.get(primary);
            if (!ref) {
                return;
            }
            this.reference[column]?.delete(primary);
            col.updateLogs("delete", stringify(primary));
            return await col.delete(primary);
        }
        else {
            const refData = await readFile(this.reference, "utf8");
            const refDataPerLine = refData.split("\n");
            const iv = refDataPerLine[0].trim();
            let u = 2;
            while (u < refDataPerLine.length) {
                const line = refDataPerLine[u];
                const parsedLine = decryptColumnFile(line, iv, this.db.securitykey);
                const [colm, pri, file] = parsedLine.split(spaceConstant);
                if (pri === stringify(primary) && column === colm) {
                    col.updateLogs("delete", stringify(primary));
                    refDataPerLine.splice(u, 1);
                    writeFileSync(this.reference, refDataPerLine.join("\n"), "utf8");
                    return await col.delete(primary);
                }
                u++;
            }
        }
    }
    async all(column, filter, limit = 10) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new WideColumnError(`Column ${column} Not Found`);
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
                const filePath = path.join(col.path, file);
                readFileSync(filePath, "utf8");
                ping += Date.now() - start;
            }
        }
        return ping / this.columns.length;
    }
    async getAllData(column) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new WideColumnError(`Column ${column} Not Found`);
        }
        return (await col.getAllData()).concat(col.memMap);
    }
    async getTransactionLog(column) {
        const col = this.columns.find((x) => x.name === column);
        if (!col) {
            throw new WideColumnError(`Column ${column} Not Found`);
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
            throw new WideColumnError(`Column ${column} Not Found`);
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
            throw new WideColumnError(`Column ${column} Not Found`);
        }
        col.unload();
    }
    async bulkSet(...data) {
        for (const [secondaryColumnData, primaryColumnData] of data) {
            if (this.primary.name !== primaryColumnData.name) {
                throw new WideColumnError("Primary Column Name Does Not Match");
            }
            const column = this.columns.find((x) => x.name === secondaryColumnData.name);
            if (!column) {
                throw new WideColumnError("Secondary Column Name Does Not Match");
            }
            if (!this.primary.matchType(primaryColumnData.value)) {
                throw new WideColumnError("Primary Column Value Does Not Match the Type: " + this.primary.type);
            }
            if (!column.matchType(secondaryColumnData.value)) {
                throw new WideColumnError("Secondary Column Value Does Not Match the Type: " + column.type);
            }
            const data = new WideColumnData({
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
//# sourceMappingURL=table.js.map