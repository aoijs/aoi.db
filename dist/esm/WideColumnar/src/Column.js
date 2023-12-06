"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const MemMap_js_1 = __importDefault(require("./MemMap.js"));
const Data_js_1 = __importDefault(require("./Data.js"));
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const promises_2 = __importDefault(require("readline/promises"));
const utils_js_1 = require("../../utils.js");
const index_js_1 = require("../../index.js");
class WideColumnarColumn {
    name;
    primaryKey;
    default;
    type;
    path;
    files;
    table;
    memMap;
    #log;
    constructor(options) {
        this.name = options.name;
        this.primaryKey = options.primaryKey;
        this.default = options.default;
        this.type = options.type;
        this.memMap = new MemMap_js_1.default({
            limit: this.table.db.options.cacheConfig.limit,
            sortFunction: this.table.db.options.cacheConfig.sortFunction,
        }, this);
        if (!this.primaryKey && this.default === undefined)
            throw new Error("Default value is required for non primary key columns");
    }
    setPath(path) {
        this.path = path;
    }
    setFiles() {
        this.files = this.#getFiles();
    }
    setTable(table) {
        this.table = table;
    }
    #getFiles() {
        return (0, fs_1.readdirSync)(this.path).filter((x) => x.endsWith(this.table.db.options.fileConfig.extension));
    }
    async initialize() {
        await this.#initalize();
        await this.#getLogInfo();
        await this.#syncWithLogs();
    }
    async #initalize() {
        const transactionPath = `${this.path}/transaction.log`;
        if (!(0, fs_1.existsSync)(transactionPath)) {
            const IV = (0, crypto_1.randomBytes)(16).toString("hex");
            await (0, promises_1.writeFile)(transactionPath, IV + "\n\n");
        }
        const referencePath = `${this.table.db.options.dataConfig.referencePath}/${this.table.name}/${this.name}`;
        if (!(0, fs_1.existsSync)(referencePath)) {
            await (0, promises_1.writeFile)(referencePath, "");
        }
        this.setFiles();
    }
    async #readIvfromLog() {
        const logFile = `${this.path}/transaction.log`;
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
    async #getLogInfo() {
        this.#log = {
            iv: await this.#readIvfromLog(),
            path: `${this.path}/transaction.log`,
            writer: (0, fs_1.createWriteStream)(`${this.path}/transaction.log`, {
                flags: "a",
                encoding: "utf8",
            }),
        };
    }
    async #syncWithLogs() {
        const logFile = this.#log.path;
        const rl = promises_2.default.createInterface({
            input: (0, fs_1.createReadStream)(logFile),
            crlfDelay: Infinity,
        });
        let index = 0;
        for await (const line of rl) {
            if (index < 2) {
                index++;
                continue;
            }
            const decrypted = (0, utils_js_1.decrypt)({
                iv: this.#log.iv,
                data: line,
            }, this.table.db.options.encryptionConfig.securityKey);
            const [columnValue, columnType, primaryValue, primaryType, method] = decrypted.split(utils_js_1.ReferenceConstantSpace);
            const parsedMethod = Number(method.trim());
            const data = new Data_js_1.default({
                column: {
                    name: this.name,
                    type: columnType,
                    value: (0, utils_js_1.parse)(columnValue, columnType),
                },
                primary: {
                    name: this.table.primary.name,
                    type: this.table.primary.type,
                    value: (0, utils_js_1.parse)(primaryValue, primaryType),
                },
            });
            if (parsedMethod === index_js_1.DatabaseMethod.Set) {
                this.memMap.set(data);
            }
            else if (parsedMethod === index_js_1.DatabaseMethod.Delete) {
                this.memMap.delete(data.column.name, data.primary.value);
            }
        }
        await this.#createNewLogCycle();
    }
    async #createNewLogCycle() {
        return new Promise((res, rej) => {
            this.#log.writer.end(() => {
                const IV = (0, crypto_1.randomBytes)(16).toString("hex");
                (0, fs_1.truncateSync)(this.#log.path);
                this.#log.iv = IV;
                this.#log.writer = (0, fs_1.createWriteStream)(this.#log.path, {
                    flags: "a",
                    encoding: "utf8",
                });
                this.#log.writer.write(IV + "\n\n", () => {
                    res();
                });
            });
        });
    }
    async #wal(data, method) {
        const json = data.toJSON();
        const delimitedString = (0, utils_js_1.createHashRawString)([
            (0, utils_js_1.stringify)(json.column.value),
            json.column.type,
            (0, utils_js_1.stringify)(json.primary.value),
            json.primary.type,
            method?.toString(),
        ]);
        const hash = (0, utils_js_1.createHash)(delimitedString, this.table.db.options.encryptionConfig.securityKey, this.#log.iv);
        this.#log.writer.write(hash + "\n");
    }
    async #flush(data) {
        return new Promise(async (res, rej) => {
            const path = `${this.path}/${this.name}_${Date.now()}.json`;
        });
    }
    set(primary, value) {
        const data = new Data_js_1.default({
            column: {
                name: this.name,
                type: this.type,
                value: value,
            },
            primary: {
                name: this.table.primary.name,
                type: this.table.primary.type,
                value: primary,
            },
        });
        this.memMap.set(data);
    }
}
exports.default = WideColumnarColumn;
//# sourceMappingURL=Column.js.map