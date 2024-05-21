import File from "./File.js";
import { readdirSync } from "node:fs";
export default class FileManager {
    #maxSize;
    #hashSize;
    #array;
    #table;
    #rehashing = false;
    constructor(maxSize, hashSize = 20, table) {
        this.#maxSize = maxSize;
        this.#hashSize = hashSize;
        this.#table = table;
    }
    async initialize() {
        const filesCount = readdirSync(this.#table.paths.table).length;
        this.#hashSize = Math.max(this.#hashSize, filesCount);
        this.#array = Array.from({ length: this.#hashSize }, (_, i) => {
            return new File(`${this.#table.paths.table}/${this.#table.options.name}_scheme_${i + 1}${this.#table.db.options.fileConfig.extension}`, this.#table.db.options.fileConfig.maxSize / 4, this.#table);
        });
        for (const file of this.#array) {
            await file.init();
        }
        if (this.#table.db.options.fileConfig.reHashOnStartup &&
            !this.#table.db.options.fileConfig.staticRehash) {
            await this.#rehash();
        }
        if (this.#table.db.options.fileConfig.staticRehash) {
            if (this.#table.db.options.fileConfig.minFileCount !==
                this.#hashSize) {
                await this.#rehash();
            }
        }
    }
    get maxHashArraySize() {
        return this.#maxSize;
    }
    get hashSize() {
        return this.#hashSize;
    }
    #hash(key) {
        const hash = key.split("").reduce((a, b) => {
            a += b.charCodeAt(0);
            return a & a;
        }, 1);
        return hash.toString(16);
    }
    async add(data) {
        if (this.#rehashing) {
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.add(data));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        }
        const hash = this.#hash(data.key);
        const index = this.#getHashIndex(hash);
        data.file = this.#array[index].name;
        await this.#array[index].put(data.key, data);
        if (this.#array[index].size > this.#maxSize &&
            !this.#table.db.options.fileConfig.staticRehash) {
            this.#rehash();
        }
    }
    #getHashIndex(hash) {
        const hashValue = parseInt(hash, 16);
        return hashValue % this.#hashSize;
    }
    async #rehash() {
        if (this.#rehashing)
            return;
        this.#rehashing = true;
        const datas = [];
        for (const file of this.#array) {
            await file.lockAndsync();
            const data = await file.getAll();
            for (const value of data) {
                datas.push(value);
            }
            await file.unlink();
        }
        const relativeSize = datas.length / this.#maxSize;
        const newArraySize = this.#table.db.options.fileConfig.staticRehash
            ? this.#table.db.options.fileConfig.minFileCount
            : 10 * Math.ceil(relativeSize + 1);
        this.#hashSize = newArraySize;
        const newArray = Array.from({ length: newArraySize }, (_, i) => {
            return new File(`${this.#table.paths.table}/${this.#table.options.name}_scheme_${i + 1}${this.#table.db.options.fileConfig.extension}`, this.#maxSize / 4, this.#table);
        });
        for (const file of newArray) {
            await file.init();
            if (file.isDirty) {
                throw new Error(`File ${file.name} is dirty!`);
            }
        }
        for (const data of datas) {
            const hash = this.#hash(data.key);
            const index = this.#getHashIndex(hash);
            data.file = newArray[index].name;
            await newArray[index].put(data.key, data);
        }
        this.#array = newArray;
        this.#rehashing = false;
    }
    remove(data) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.remove(data));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        const hash = this.#hash(data);
        const index = this.#getHashIndex(hash);
        this.#array[index].remove(data);
    }
    get(key) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.get(key));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        const hash = this.#hash(key);
        const index = this.#getHashIndex(hash);
        return this.#array[index].get(key);
    }
    clear() {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.clear());
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        for (const file of this.#array) {
            file.clear();
        }
    }
    has(key) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.has(key));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        const hash = this.#hash(key);
        const index = this.#getHashIndex(hash);
        return this.#array[index].has(key);
    }
    async all(query, limit, order) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.all(query, limit, order));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        if (order === "firstN") {
            const data = new Set();
            for (const file of this.#array) {
                for (const value of file.cache.all()) {
                    data.add(value);
                    if (data.size === limit)
                        return Array.from(data);
                }
            }
            for (const file of this.#array) {
                const d = await file.getAll(query);
                for (const value of d) {
                    data.add(value);
                    if (data.size == limit)
                        return Array.from(data);
                }
            }
            return Array.from(data);
        }
        else {
            const data = [];
            for (const file of this.#array) {
                const d = await file.getAll(query);
                for (const value of d) {
                    data.push(value);
                }
            }
            if (order === "asc") {
                data.sort((a, b) => this.#table.db.options.cacheConfig.sortFunction(a, b));
            }
            else {
                data.sort((a, b) => this.#table.db.options.cacheConfig.sortFunction(a, b)).reverse();
            }
            return data.slice(0, limit);
        }
    }
    async findOne(query) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.findOne(query));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        for (const file of this.#array) {
            const d = await file.findOne(query);
            if (d)
                return d;
        }
    }
    async findMany(query) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.findMany(query));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        const data = [];
        for (const file of this.#array) {
            const d = await file.getAll(query);
            for (const value of d) {
                data.push(value);
            }
        }
        return data;
    }
    async getFirstN(query, limit) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.getFirstN(query, limit));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        const data = [];
        for (const file of this.#array) {
            const d = await file.getAll(query);
            for (const value of d) {
                data.push(value);
                if (data.length == limit)
                    return data;
            }
        }
        return data;
    }
    async removeMany(query) {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.removeMany(query));
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        for (const file of this.#array) {
            await file.removeMany(query);
        }
    }
    async ping() {
        if (this.#rehashing)
            return new Promise((res) => {
                let timeout;
                const fn = async () => {
                    if (!this.#rehashing) {
                        clearTimeout(timeout);
                        res(await this.ping());
                    }
                    else {
                        timeout = setTimeout(fn, 100);
                    }
                };
                timeout = setTimeout(fn, 100);
            });
        let sum = 0;
        for (const file of this.#array) {
            sum += await file.ping();
        }
        return sum / this.#hashSize;
    }
}
//# sourceMappingURL=FileManager.js.map