import { createWriteStream, readdirSync, statSync } from "fs";
import { ReferenceConstantSpace } from "../utils.js";
import { readFile, truncate, unlink } from "fs/promises";
import { ReferenceType } from "../typings/enum.js";
export default class Referencer {
    cache = {};
    cacheSize = -1;
    #path;
    files;
    maxSize;
    type;
    constructor(path, maxSize, type) {
        this.type = type;
        this.#path = path;
        this.maxSize = maxSize;
    }
    /**
     * Description initialize the Referencer
     * @returns
     */
    async initialize() {
        this.files = readdirSync(this.#path).map((file) => {
            return {
                name: file,
                size: statSync(this.#path + "/" + file).size,
                writer: createWriteStream(this.#path + "/" + file, {
                    flags: "a",
                    encoding: "utf-8",
                }),
            };
        });
        if (this.type === ReferenceType.Cache)
            this.cache = await this.#getReference();
    }
    get path() {
        return this.#path;
    }
    /**
     * @private
     * @description get reference from files
     * @returns
     */
    async #getReference() {
        const reference = {};
        for (const file of this.files) {
            const data = await readFile(this.#path + "/" + file.name, "utf-8");
            if (data.trim() === "")
                return reference;
            const lines = data.split("\n");
            for (const line of lines) {
                const [key, value] = line.split(ReferenceConstantSpace);
                reference[key] = {
                    file: value,
                    referenceFile: file.name,
                };
            }
        }
        return reference;
    }
    /**
     * @description get references
     * @returns
     *
     * @example
     * ```js
     * <Referencer>.getReference() // {key:{file:"file",referenceFile:"referenceFile"}}
     * ```
     */
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
    /**
     * @private
     * @description save reference to file
     * @param key key to save
     * @param file file to save
     */
    async #saveReference(key, file) {
        return new Promise((resolve, reject) => {
            const string = `${key}${ReferenceConstantSpace}${file}\n`;
            let currentFile = this.#currentFile();
            if (currentFile.size + string.length > this.maxSize) {
                this.#createFile();
                if (this.cacheSize !== -1) {
                    this.cache[key].referenceFile = this.#currentFile().name;
                }
                currentFile = this.#currentFile();
            }
            currentFile.writer.write(string, (err) => {
                if (err)
                    reject(err);
                else {
                    this.files.at(-1).size += string.length;
                    resolve(undefined);
                }
            });
        });
    }
    /**
     * @description get current file
     * @private
     * @returns  current file
     */
    #currentFile() {
        return this.files.at(-1);
    }
    /**
     * @description create file
     * @private
     * @returns
     */
    #createFile() {
        const file = this.#path + "/reference_" + (this.files.length + 1) + ".log";
        this.files.push({
            name: "reference_" + (this.files.length + 1) + ".log",
            size: 0,
            writer: createWriteStream(file, {
                flags: "a",
                encoding: "utf-8",
            }),
        });
    }
    /**
     * @description set reference
     * @param key key to set
     * @param file file to set
     *
     * @example
     *
     * ```js
     * <Referencer>.setReference("key","file")
     * ```
     */
    async setReference(key, file) {
        if (this.cacheSize !== -1) {
            this.cache[key] = {
                file,
                referenceFile: this.#currentFile().name,
            };
            this.cacheSize++;
        }
        await this.#saveReference(key, file);
    }
    /**
     * @description delete reference
     * @param key key to delete
     *
     * @example
     * ```js
     * <Referencer>.deleteReference("key")
     * ```
     */
    async deleteReference(key) {
        let referenceFile;
        if (this.cacheSize !== -1) {
            referenceFile = this.cache[key]?.referenceFile;
            if (!referenceFile)
                return;
            delete this.cache[key];
            this.cacheSize--;
        }
        else {
            const reference = await this.getReference();
            referenceFile = reference[key]?.referenceFile;
            if (!referenceFile)
                return;
        }
        await this.#deleteReference(key, referenceFile);
    }
    /**
     * @description delete reference
     * @private
     * @param key key to delete
     * @param file file to delete
     */
    async #deleteReference(key, file) {
        const reference = await this.#getFileReference(file);
        delete reference[key];
        const string = Object.entries(reference).map(([key, value]) => {
            return `${key}${ReferenceConstantSpace}${value}\n`;
        });
        await truncate(this.#path + "/" + file, 0);
        this.files
            .find((fil) => fil.name === file)
            .writer.write(string.join(""));
    }
    /**
     * @description get all references from file
     * @param file file to get reference
     * @returns
     */
    async #getFileReference(file) {
        const path = this.#path + "/" + file;
        const reference = {};
        const data = await readFile(this.#path + "/" + file, "utf-8");
        const lines = data.split("\n");
        for (const line of lines) {
            const [key, value] = line.split(ReferenceConstantSpace);
            reference[key] = value;
        }
        return reference;
    }
    /**
     * @description clear the Referencer
     *
     * @example
     * ```js
     * <Referencer>.clear()
     * ```
     */
    async clear() {
        for (const file of this.files) {
            file.size = 0;
            file.writer.close();
            if (file.name !== "reference_1.log") {
                await unlink(this.#path + "/" + file.name);
            }
            else {
                await truncate(this.#path + "/" + file.name, 0);
            }
        }
        this.files = this.files.slice(0, 1);
        this.files[0].writer = createWriteStream(this.#path + "/reference_1.log", {
            flags: "a",
            encoding: "utf-8",
        });
        this.cache = {};
        if (this.cacheSize !== -1) {
            this.cacheSize = -1;
        }
    }
    /**
     * @description open the Referencer
     *
     * @example
     * ```js
     * <Referencer>.open()
     * ```
     */
    open() {
        for (const file of this.files) {
            file.writer = createWriteStream(this.#path + "/" + file.name, {
                flags: "a",
                encoding: "utf-8",
            });
        }
    }
    /**
     * @description restart the Referencer
     *
     * @example
     * ```js
     * <Referencer>.restart()
     * ```
     */
    async bulkDeleteReference(keys) {
        let referenceFile;
        const referenceFileObj = {};
        const set = new Set();
        for (const key of keys) {
            if (this.cacheSize !== -1) {
                referenceFile = this.cache[key].referenceFile;
                set.add(referenceFile);
                if (!referenceFileObj[referenceFile])
                    referenceFileObj[referenceFile] = [];
                referenceFileObj[referenceFile].push(key);
                delete this.cache[key];
                this.cacheSize--;
            }
            else {
                const reference = await this.getReference();
                this.cache = reference;
                this.cacheSize = Object.keys(this.cache).length;
                referenceFile = reference[key].referenceFile;
                set.add(referenceFile);
                if (!referenceFileObj[referenceFile])
                    referenceFileObj[referenceFile] = [];
                referenceFileObj[referenceFile].push(key);
                delete this.cache[key];
                this.cacheSize--;
            }
            for (const file of set) {
                await this.#bulkDeleteReference(referenceFileObj[file], file);
            }
        }
    }
    async #bulkDeleteReference(keys, file) {
        const reference = await this.#getFileReference(file);
        for (const key of keys) {
            delete reference[key];
        }
        const string = Object.entries(reference).map(([key, value]) => {
            return `${key}${ReferenceConstantSpace}${value}\n`;
        });
        await truncate(this.#path + "/" + file, 0);
        this.files
            .find((fil) => fil.name === file)
            .writer.write(string.join(""));
    }
    restart() {
        for (const file of this.files) {
            if (!file.writer.closed)
                file.writer.close();
        }
        this.files = readdirSync(this.#path).map((file) => {
            return {
                name: file,
                size: statSync(this.#path + "/" + file).size,
                writer: createWriteStream(this.#path + "/" + file, {
                    flags: "a",
                    encoding: "utf-8",
                }),
            };
        });
    }
    async bulkSetReference(reference) {
        const set = new Set();
        for (const key in reference) {
            if (this.cacheSize !== -1) {
                set.add(this.cache[key].referenceFile);
                this.cache[key].file = reference[key];
            }
            this.#saveReference(key, reference[key]);
        }
    }
    async sync(files, table) {
        await this.clear();
        for (const file of files) {
            const data = await table.fetchFile(`${table.paths.table}/${file}`);
            if (!data)
                continue;
            for (const key in data) {
                this.#saveReference(key, file);
            }
        }
    }
}
//# sourceMappingURL=referencer.js.map