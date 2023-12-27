"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const referencer_js_1 = __importDefault(require("../../global/referencer.js"));
const index_js_1 = require("../../index.js");
class WideColumnarReferencer extends referencer_js_1.default {
    cache;
    files = [];
    #column;
    constructor(path, maxSize, type, column) {
        super(path, maxSize, type);
        this.cache = {};
        this.#column = column;
    }
    async initialize() {
        if (!(0, fs_1.existsSync)(this.path + "/reference_0.wdcr")) {
            this.#createFile();
        }
        await this.#syncReference();
    }
    async #syncReference() {
        const columnPath = `${this.#column.table.db.options.dataConfig.path}/${this.#column.table.name}/${this.#column.name}`;
        // delete all reference files
        const path = this.path;
        (0, fs_1.rmdirSync)(path, { recursive: true });
        this.files = [];
        this.#createFile();
        const files = (0, fs_1.readdirSync)(columnPath);
        for (const file of files) {
            const data = await (0, promises_1.readFile)(columnPath + "/" + file, "utf-8");
            const lines = data.split("\n");
            for (const line of lines) {
                const [key, value] = line.split(index_js_1.ReferenceConstantSpace);
                this.#saveReference(key, value);
            }
        }
    }
    async #getReference() {
        const reference = {};
        for (const file of this.files) {
            const data = await (0, promises_1.readFile)(this.path + "/" + file.name, "utf-8");
            if (data.trim() === "")
                return reference;
            const lines = data.split("\n");
            for (const line of lines) {
                const [key, value, index] = line.split(index_js_1.ReferenceConstantSpace);
                reference[key] = {
                    file: value,
                    referenceFile: file.name,
                    index: parseInt(index),
                };
            }
        }
        return reference;
    }
    #getIndex(file) {
        const read = (0, fs_1.readFileSync)(this.path + "/" + file, "utf-8");
        const total = read.split("\n").length;
        return total;
    }
    #saveReference(key, file) {
        let string = `${key}${index_js_1.ReferenceConstantSpace}${file}`;
        let currentFile = this.#currentFile();
        if (currentFile.size + string.length > this.maxSize) {
            this.#createFile();
            if (this.cacheSize !== -1) {
                this.cache[key].referenceFile = this.#currentFile().name;
            }
            currentFile = this.#currentFile();
        }
        string += `${index_js_1.ReferenceConstantSpace}${currentFile.index}\n`;
        currentFile.writer.write(string);
        this.files.at(-1).size += string.length;
    }
    async setReference(key, file) {
        if (this.cacheSize !== -1) {
            this.cache[key] = {
                file,
                referenceFile: this.#currentFile().name,
                index: this.#getIndex(this.#currentFile().name),
            };
            this.cacheSize++;
        }
        this.#saveReference(key, file);
    }
    #currentFile() {
        return this.files.at(-1);
    }
    #createFile() {
        const name = `reference_${this.files.length}.txt`;
        this.files.push({
            name,
            size: 0,
            writer: (0, fs_1.createWriteStream)(this.path + "/" + name, {
                flags: "a",
                encoding: "utf-8",
            }),
            index: 0,
        });
    }
    async getReference() {
        if (this.cacheSize === -1) {
            this.cache = await this.#getReference();
            this.cacheSize = Object.keys(this.cache).length;
            if (this.type === index_js_1.ReferenceType.File)
                setTimeout(() => {
                    this.cache = {};
                    this.cacheSize = -1;
                }, 60000);
        }
        return this.cache;
    }
}
exports.default = WideColumnarReferencer;
//# sourceMappingURL=Referencer.js.map