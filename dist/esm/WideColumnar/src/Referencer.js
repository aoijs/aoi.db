import { createWriteStream, existsSync, readFileSync, readdirSync, rmdirSync, } from "fs";
import { readFile } from "fs/promises";
import Referencer from "../../global/referencer.js";
import { ReferenceConstantSpace, ReferenceType } from "../../index.js";
export default class WideColumnarReferencer extends Referencer {
    cache;
    files = [];
    #column;
    constructor(path, maxSize, type, column) {
        super(path, maxSize, type);
        this.cache = {};
        this.#column = column;
    }
    async initialize() {
        if (!existsSync(this.path + "/reference_0.wdcr")) {
            this.#createFile();
        }
        await this.#syncReference();
    }
    async #syncReference() {
        const columnPath = `${this.#column.table.db.options.dataConfig.path}/${this.#column.table.name}/${this.#column.name}`;
        // delete all reference files
        const path = this.path;
        rmdirSync(path, { recursive: true });
        this.files = [];
        this.#createFile();
        const files = readdirSync(columnPath);
        for (const file of files) {
            const data = await readFile(columnPath + "/" + file, "utf-8");
            const lines = data.split("\n");
            for (const line of lines) {
                const [key, value] = line.split(ReferenceConstantSpace);
                this.#saveReference(key, value);
            }
        }
    }
    async #getReference() {
        const reference = {};
        for (const file of this.files) {
            const data = await readFile(this.path + "/" + file.name, "utf-8");
            if (data.trim() === "")
                return reference;
            const lines = data.split("\n");
            for (const line of lines) {
                const [key, value, index] = line.split(ReferenceConstantSpace);
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
        const read = readFileSync(this.path + "/" + file, "utf-8");
        const total = read.split("\n").length;
        return total;
    }
    #saveReference(key, file) {
        let string = `${key}${ReferenceConstantSpace}${file}`;
        let currentFile = this.#currentFile();
        if (currentFile.size + string.length > this.maxSize) {
            this.#createFile();
            if (this.cacheSize !== -1) {
                this.cache[key].referenceFile = this.#currentFile().name;
            }
            currentFile = this.#currentFile();
        }
        string += `${ReferenceConstantSpace}${currentFile.index}\n`;
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
            writer: createWriteStream(this.path + "/" + name, {
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
            if (this.type === ReferenceType.File)
                setTimeout(() => {
                    this.cache = {};
                    this.cacheSize = -1;
                }, 60000);
        }
        return this.cache;
    }
}
//# sourceMappingURL=Referencer.js.map