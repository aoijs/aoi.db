"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Column = void 0;
const cacher_js_1 = require("./cacher.js");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const functions_js_1 = require("../utils/functions.js");
const data_js_1 = require("./data.js");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const constants_js_1 = require("./constants.js");
const error_js_1 = require("./error.js");
class Column {
    name;
    routers = {};
    queue;
    type;
    primary;
    sortOrder;
    memMap;
    table;
    path;
    files;
    logIv;
    logLines;
    default;
    constructor(options) {
        this.name = options.name;
        this.type = options.type;
        this.primary = options.primary;
        this.sortOrder = options.sortOrder ?? "DESC";
        if (options.default && !this.matchType(options.default) && this.primary)
            throw new error_js_1.WideColumnError(`Default value is not of type ${this.type}`);
        if (options.default && !this.primary)
            throw new error_js_1.WideColumnError(`Default value can only be set for primary column`);
        this.default = options.default;
        this.queue = {
            set: false,
            delete: false,
        };
    }
    setFiles() {
        this.files = this._getFiles();
    }
    setTable(table) {
        this.table = table;
    }
    setPath(path) {
        this.path = path;
    }
    setCache() {
        this.memMap = new cacher_js_1.WideColumnMemMap({
            ...this.table.db.options.cacheOption,
            sortOrder: this.sortOrder,
        });
    }
    _getFiles() {
        return (0, fs_1.readdirSync)(this.path).filter((x) => x.endsWith(this.table.db.options.extension));
    }
    async loadData() {
        if (this.primary)
            return;
        if (!this.memMap)
            return;
        const primaryColumn = this.table.primary;
        let i = 0;
        if (!(0, fs_1.existsSync)(path_1.default.join(this.path, "transactions.log"))) {
            const randomIv = (0, crypto_1.randomBytes)(16);
            this.logIv = randomIv.toString("hex");
            (0, fs_1.writeFileSync)(path_1.default.join(this.path, "transactions.log"), `${randomIv.toString("hex")}\n\n`);
        }
        while (i < this.files.length) {
            const file = this.files[i];
            const readData = (0, fs_1.readFileSync)(path_1.default.join(this.path, file), "utf8");
            const dataPerLine = readData.split("\n");
            let u = 2;
            const iv = dataPerLine[0]?.trim();
            if (!iv) {
            }
            this.routers[file] = dataPerLine.length - 2;
            while (u < dataPerLine.length) {
                const Parsedline = (0, functions_js_1.decryptColumnFile)(dataPerLine[u], iv, this.table.db.securitykey);
                const [primaryColumnRawValue, _] = Parsedline.split(constants_js_1.spaceConstant);
                if (typeof this.table.reference === "object") {
                    this.table.reference[this.name] = new Map().set(primaryColumn.parse(primaryColumnRawValue), file);
                }
                else {
                    (0, fs_1.appendFileSync)(this.table.reference, `${this.name}${constants_js_1.spaceConstant}${primaryColumnRawValue}${constants_js_1.spaceConstant}${file}\n`);
                }
                u++;
            }
            i++;
        }
        const logData = (0, fs_1.readFileSync)(this.logPath).toString();
        const logDataPerLine = logData.split("\n");
        this.logLines = logDataPerLine.length - 2;
        const iv = logDataPerLine[0]?.trim();
        this.logIv = iv;
        let u = 2;
        const deleteData = [];
        while (u < logDataPerLine.length) {
            const Parsedline = (0, functions_js_1.decryptColumnFile)(logDataPerLine[u], iv, this.table.db.securitykey);
            const [method, ...value] = Parsedline.split(constants_js_1.spaceConstant);
            if (method === "[set]") {
                const [primaryColumnRawValue, secondaryColumnRawValue] = value;
                const primaryColumnValue = primaryColumn.parse(primaryColumnRawValue.replaceAll("#COLUMNSPLITER#", constants_js_1.spaceConstant));
                const secondaryColumnValue = this.parse(secondaryColumnRawValue.replaceAll("#COLUMNSPLITER#", constants_js_1.spaceConstant));
                const data = new data_js_1.WideColumnData({
                    primaryColumnName: primaryColumn.name,
                    primaryColumnType: primaryColumn.type,
                    primaryColumnValue: primaryColumnValue,
                    secondaryColumnName: this.name,
                    secondaryColumnType: this.type,
                    secondaryColumnValue: secondaryColumnValue,
                });
                this.memMap.set(primaryColumnValue, data);
            }
            else if (method === "[delete]") {
                const [primaryColumnRawValue, secondaryColumnRawValue] = value;
                const primaryColumnValue = primaryColumn.parse(primaryColumnRawValue);
                this.memMap.delete(primaryColumnValue);
                deleteData.push(primaryColumnValue);
            }
            u++;
        }
        u = 0;
        if (deleteData.length) {
            const allData = (await this.getAllData()).deleteDatas(...deleteData);
            await this.flush(allData);
            this.newLogCycle();
        }
        this.memMap.sort();
    }
    parse(value) {
        const type = this.type;
        if (type === "string")
            return value;
        else if (type === "number") {
            return Number(value);
        }
        else if (type === "boolean") {
            return value === "true";
        }
        else if (type === "date") {
            return new Date(value);
        }
        else if (type === "object") {
            return JSON.parse(value);
        }
        else if (type === "bigint") {
            return BigInt(value);
        }
        else if (type === "buffer") {
            return Buffer.from(value);
        }
        else {
            return (0, fs_1.createReadStream)(value);
        }
    }
    matchType(data) {
        const type = this.type;
        if (type === "string")
            return typeof data === "string";
        else if (type === "number") {
            return typeof data === "number";
        }
        else if (type === "boolean") {
            return typeof data === "boolean";
        }
        else if (type === "date") {
            return data instanceof Date;
        }
        else if (type === "object") {
            return typeof data === "object";
        }
        else if (type === "bigint") {
            return typeof data === "bigint";
        }
        else if (type === "buffer") {
            return data instanceof Buffer;
        }
        else {
            return data instanceof ReadableStream;
        }
    }
    async set(key, value) {
        if (!this.memMap)
            return;
        if (this.memMap.data.size < this.table.db.options.storeOption.maxDataPerFile) {
            await this.updateLogs("set", value);
            this.memMap.set(key, value);
            this.memMap.sort();
        }
        else {
            await this.flush();
            this.memMap.clear();
            this.newLogCycle();
            await this.updateLogs("set", value);
            this.memMap.set(key, value);
            this.memMap.sort();
        }
    }
    async updateLogs(method, value) {
        const logFile = this.logPath;
        const data = value?.toString();
        const iv = this.logIv;
        const encryptedData = (0, functions_js_1.encryptColumnData)(`[${method}]${constants_js_1.spaceConstant}${data}`, this.table.db.securitykey, iv);
        (0, fs_1.appendFileSync)(logFile, encryptedData + "\n");
        this.logLines++;
        if (this.logLines > this.table.db.options.cacheOption.limit * 2) {
            await this.flush();
            this.newLogCycle();
        }
    }
    async readIvfromLog() {
        const logFile = this.logPath;
        return new Promise(async (res, rej) => {
            if (!(0, fs_1.existsSync)(logFile)) {
                rej("log file not found");
            }
            else {
                let iv;
                const rs = (0, fs_1.createReadStream)(logFile, {
                    highWaterMark: 33,
                    encoding: "utf8",
                    flags: "r",
                });
                rs.on("data", async (chunk) => {
                    iv = chunk;
                    rs.close();
                })
                    .on("error", (err) => {
                    rej(err);
                })
                    .on("close", () => {
                    res(iv);
                });
            }
        });
    }
    async flush(mem) {
        if (!this.memMap)
            return;
        const memMap = this.memMap;
        const maxDataPerFile = this.table.db.options.storeOption.maxDataPerFile;
        const data = mem
            ? [...mem.data.values()].sort((a, b) => {
                if ((a.secondary.value ?? 0) < (b.secondary.value ?? 0))
                    return memMap.options.sortOrder === "DESC" ? 1 : -1;
                else if ((a.secondary.value ?? 0) === (b.secondary.value ?? 0))
                    return 0;
                else
                    return memMap.options.sortOrder === "DESC" ? -1 : 1;
            })
            : [...(await this.getAllData()).concat(memMap).data.values()].sort((a, b) => {
                if ((a.secondary.value ?? 0) < (b.secondary.value ?? 0))
                    return memMap.options.sortOrder === "DESC" ? 1 : -1;
                else if ((a.secondary.value ?? 0) === (b.secondary.value ?? 0))
                    return 0;
                else
                    return memMap.options.sortOrder === "DESC" ? -1 : 1;
            });
        let i = 0;
        while (data.slice(i * maxDataPerFile).length >= maxDataPerFile) {
            if (i >= this.files.length) {
                this._createNewFile();
            }
            const file = this.files[i];
            const iv = (0, crypto_1.randomBytes)(16).toString("hex");
            const slicedData = data.slice(i * maxDataPerFile, (i + 1) * maxDataPerFile);
            const slice = slicedData.map((x) => (0, functions_js_1.encryptColumnData)(x.toString(), this.table.db.securitykey, iv));
            const dataToWrite = slice.join("\n");
            (0, fs_1.writeFileSync)(path_1.default.join(this.path, file), `${iv}\n\n${dataToWrite}`);
            slicedData.forEach((x) => {
                if (typeof this.table.reference === "object") {
                    let obj = this.table.reference[this.name];
                    if (!obj) {
                        obj = new Map();
                    }
                    this.table.reference[this.name] = obj.set(x.primary.value, file);
                }
                else {
                    (0, fs_1.appendFileSync)(this.table.reference, `${this.name}${constants_js_1.spaceConstant}${x.primary.value}${constants_js_1.spaceConstant}${file}\n`);
                }
            });
            i++;
        }
        const leftData = data.slice(i * maxDataPerFile);
        if (leftData.length) {
            let u = 0;
            while (u < leftData.length) {
                this.memMap.set(leftData[u].primary.value, leftData[u]);
                u++;
            }
        }
        if (this.files.length > i) {
            const extraFiles = this.files.splice(i, this.files.length - i);
            extraFiles.forEach((file) => {
                (0, fs_1.unlinkSync)(path_1.default.join(this.path, file));
            });
        }
    }
    newLogCycle() {
        if (!this.files.length)
            return;
        const logFile = this.logPath;
        const iv = (0, crypto_1.randomBytes)(16).toString("hex");
        this.logIv = iv;
        (0, fs_1.writeFileSync)(logFile, iv + "\n\n");
    }
    get logPath() {
        return path_1.default.join(this.path, "transactions.log");
    }
    _createNewFile() {
        const fileName = `${this.name}_${this.files.length + 1}${this.table.db.options.extension}`;
        (0, fs_1.writeFileSync)(path_1.default.join(this.path, fileName), "");
        this.files.push(fileName);
    }
    async getAllData() {
        let i = 0;
        const map = new cacher_js_1.WideColumnMemMap({
            limit: Infinity,
        });
        while (i < this.files.length) {
            const file = this.files[i];
            const filePath = path_1.default.join(this.path, file);
            const data = await (0, promises_1.readFile)(filePath, "utf8");
            const iv = data.split("\n\n")[0];
            const dataToDecrypt = data.split("\n\n")[1];
            const dataPerLine = dataToDecrypt.split("\n").forEach((x) => {
                x = (0, functions_js_1.decryptColumnFile)(x, iv, this.table.db.securitykey);
                const [primaryColumnValue, ...secondaryColumnValue] = x.split(constants_js_1.spaceConstant);
                const d = new data_js_1.WideColumnData({
                    primaryColumnName: this.table.primary.name,
                    primaryColumnType: this.table.primary.type,
                    primaryColumnValue: this.table.primary.parse(primaryColumnValue),
                    secondaryColumnName: this.name,
                    secondaryColumnType: this.type,
                    secondaryColumnValue: this.parse(secondaryColumnValue.join(constants_js_1.spaceConstant)),
                });
                map.set(d.primary.value, d);
            });
            i++;
        }
        return map;
    }
    async eval(str) {
        const sc = constants_js_1.spaceConstant;
        const rfs = fs_1.readFileSync;
        const ecd = functions_js_1.encryptColumnData;
        const dcd = functions_js_1.decryptColumnFile;
        return await eval(str);
    }
    async delete(primary) {
        if (!this.memMap)
            return;
        const memMap = this.memMap;
        if (!this.files.length) {
            return memMap.delete(primary);
        }
        else {
            this.table.queue.addToQueue("delete", this.name, primary);
            if (!this.table.queue.queued.delete) {
                this.table.queue.queued.delete = true;
                const timeout = setTimeout(async () => {
                    const allData = (await this.getAllData()).concat(memMap);
                    allData.deleteDatas(...(this.table.queue.queue.delete.get(this.name)?.values() || []));
                    await this.flush(allData);
                    this.newLogCycle();
                    this.table.queue.queued.delete = false;
                    this.table.queue.queue.delete.clear();
                    clearTimeout(timeout);
                }, this.table.db.options.methodOption.deleteTime);
            }
        }
    }
    async getTransactionLog() {
        const logFile = this.logPath;
        const data = await (0, promises_1.readFile)(logFile, "utf8");
        const dataPerLine = data.split("\n");
        const iv = dataPerLine[0];
        let i = 2;
        const res = [];
        while (i < dataPerLine.length) {
            const line = (0, functions_js_1.decryptColumnFile)(dataPerLine[i], iv, this.table.db.securitykey);
            res.push(line);
            i++;
        }
        return res.join("\n");
    }
    clear() {
        this.newLogCycle();
        this.files.forEach((file) => {
            (0, fs_1.unlinkSync)(path_1.default.join(this.path, file));
        });
        this.memMap.clear();
        this.files = [];
    }
    unload() {
        this.table.columns = this.table.columns.filter((x) => x.name !== this.name);
    }
    async bulkSet(...data) {
        if (!this.memMap)
            return;
        data.forEach(async (x) => {
            await this.set(x[0], x[1]);
        });
    }
}
exports.Column = Column;
//# sourceMappingURL=column.js.map