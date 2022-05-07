import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, } from "fs";
import { readFile, rename, rm, writeFile } from "fs/promises";
import { DatabaseEvents } from "../typings/enums.js";
import { decrypt, encrypt, JSONParser } from "../utils/functions.js";
import { Cacher } from "./cacher.js";
import { Data } from "./data.js";
import { KeyValueQueue as Queue } from "./queueManager.js";
export class Table {
    name;
    path;
    db;
    queue = new Queue();
    files;
    references;
    cache;
    routers = {};
    ready = false;
    readyTimestamp = -1;
    #ping;
    #lastPingTimestamp;
    constructor(name, path, db) {
        this.name = name;
        this.path = path;
        this.db = db;
        this.#ping = -1;
        this.#lastPingTimestamp = -1;
        this.cache = new Cacher(this.db.options.cacheOption);
        this.references =
            this.db.options.cacheOption.cacheReference === "MEMORY"
                ? new Map()
                : `${this.path}/$referencePath.json`;
        this.files = this._getFiles();
    }
    _getFiles() {
        return readdirSync(this.path).filter((x) => x !== "$referencePath.json");
    }
    async set(key, value) {
        const oldData = this.cache.get(key);
        if (oldData) {
            const newData = new Data({
                key,
                ...value,
                file: oldData.file,
            });
            this.cache.set(key, newData);
            this.queue.addToQueue("set", oldData.file, key, newData);
            this.routers[newData.file] += 1;
        }
        else {
            let file;
            if (this.references instanceof Map) {
                file = this.references.get(key);
                if (file) {
                    const newData = new Data({ key, ...value, file: file });
                    this.cache.set(key, newData);
                    this.queue.addToQueue("set", file, key, newData);
                }
                else {
                    file = this._currentFile();
                    if (this.routers[file] >= this.db.options.storeOption.maxDataPerFile) {
                        this._createNewFile();
                        file = this._currentFile();
                    }
                    const newData = new Data({ key, ...value, file });
                    this.cache.set(key, newData);
                    this.queue.addToQueue("set", newData.file, key, newData);
                    this.setReference(key, file);
                    this.routers[newData.file] += 1;
                }
            }
            else {
                if (!this.queue.queue.tempref) {
                    this.queue.queue.tempref = this._getReferenceDataFromFile();
                }
                file = this.queue.queue.tempref?.[key];
                if (file) {
                    const newData = new Data({ key, ...value, file: file });
                    this.cache.set(key, newData);
                    this.queue.addToQueue("set", file, key, newData);
                }
                else {
                    file = this._currentFile();
                    if (this.routers[file] >= this.db.options.storeOption.maxDataPerFile) {
                        this._createNewFile();
                    }
                    file = this._currentFile();
                    this.setReference(key, file);
                    const newData = new Data({ key, ...value, file });
                    this.cache.set(key, newData);
                    this.queue.addToQueue("set", newData.file, key, newData);
                    this.routers[newData.file] += 1;
                }
            }
        }
        if (!this.queue.queued.set) {
            this.queue.queued.set = true;
            const timeout = setTimeout(async () => {
                await this._update();
                delete this.queue.queue.tempref;
                this.queue.queued.set = false;
                clearTimeout(timeout);
            }, this.db.options.methodOption.saveTime);
        }
    }
    async _update() {
        const encryptOption = this.db.options.encryptOption;
        const files = this.queue.queue.set;
        for (const [file, mapData] of files) {
            let readData = (await readFile(`${this.path}/${file}`)).toString();
            if (encryptOption.enabled) {
                const HashData = JSONParser(readData);
                if (HashData.iv) {
                    readData = decrypt(HashData, encryptOption.securitykey);
                }
                else {
                    readData = "{}";
                }
            }
            const JSONData = JSONParser(readData);
            for (const [key, data] of mapData) {
                this.setReference(key, file);
                JSONData[key] = data.toJSON();
            }
            let writeData = JSON.stringify(JSONData);
            if (encryptOption.enabled) {
                writeData = JSON.stringify(encrypt(writeData, encryptOption.securitykey));
            }
            await writeFile(`${this.path}/$temp_${file}`, writeData);
            await rm(`${this.path}/${file}`);
            await rename(`${this.path}/$temp_${file}`, `${this.path}/${file}`);
            this.queue.deletePathFromQueue("set", file);
        }
        this._createReferencePath();
    }
    _currentFile() {
        return this.files[this.files.length - 1];
    }
    connect() {
        const encryptOption = this.db.options.encryptOption;
        const start = performance.now();
        const files = this.files;
        if (!files.length) {
            this._createNewFile();
            this.db._debug("ADDTABLEFILE", `created Table ${this.name} file`);
        }
        for (const file of files) {
            if (file.startsWith("$temp_")) {
                let JSONData = {};
                let tempdata = readFileSync(`${this.path}/${file}`);
                let readData = readFileSync(`${this.path}/${file.replace("$temp_", "")}`);
                if (tempdata.byteLength > readData.byteLength) {
                    if (encryptOption.enabled) {
                        const HashData = JSONParser(tempdata.toString());
                        if (!HashData.iv) {
                            this.routers[file] = 0;
                            continue;
                        }
                        JSONData = JSONParser(decrypt(HashData, encryptOption.securitykey));
                    }
                }
                else {
                    JSONData = JSONParser(readData.toString());
                }
                const keys = Object.keys(JSONData);
                this.routers[file] = keys.length;
                for (const key of keys) {
                    if (JSONData[key].ttl) {
                        const timeout = setTimeout(() => {
                            this.delete(key);
                            clearTimeout(timeout);
                        }, JSONData[key].ttl);
                    }
                    this.cache.manualSet(key, new Data({ ...JSONData[key], file }));
                    this.setReference(key, file);
                }
            }
            else {
                const readData = readFileSync(`${this.path}/${file}`).toString();
                let JSONData;
                if (encryptOption.enabled) {
                    const HashData = JSONParser(readData);
                    if (!HashData.iv) {
                        this.routers[file] = 0;
                        continue;
                    }
                    JSONData = JSONParser(decrypt(HashData, encryptOption.securitykey));
                }
                else {
                    JSONData = JSONParser(readData);
                }
                const keys = Object.keys(JSONData);
                this.routers[file] = keys.length;
                for (const key of keys) {
                    this.cache.manualSet(key, new Data({ ...JSONData[key], file }));
                    this.setReference(key, file);
                }
            }
        }
        this.cache.sort();
        if (this.db.options.cacheOption.cacheReference === "DISK") {
            this._createReferencePath();
        }
        this.db.emit(DatabaseEvents.TABLE_READY, this);
        this.ready = true;
        this.readyTimestamp = Date.now();
        this.db._debug("TABLE_READY", `
|----------------|---------------|
| connectionTime |   ${(performance.now() - start).toFixed(5)}ms   |
| readyTimestamp | ${this.readyTimestamp} |
|----------------|---------------|`);
    }
    _createNewFile() {
        const fileName = `${this.name}_scheme_${this.files.length + 1}${this.db.options.extension}`;
        this.files.push(fileName);
        writeFileSync(`${this.path}/${fileName}`, "{}");
        this.routers[fileName] = 0;
    }
    setReference(key, file) {
        if (this.references instanceof Map) {
            this.references.set(key, file);
        }
        else {
            if (!this.queue.queue.tempref)
                this.queue.queue.tempref = {};
            this.queue.queue.tempref[key] = file;
        }
    }
    _getReferenceDataFromFile() {
        let res;
        const encryptOption = this.db.options.encryptOption;
        if (typeof this.references !== "string")
            return;
        let readData = readFileSync(this.references).toString();
        if (encryptOption.enabled) {
            const HashData = JSONParser(readData);
            readData = decrypt(HashData, encryptOption.securitykey);
        }
        return JSONParser(readData);
    }
    _createReferencePath() {
        if (typeof this.references !== "string")
            return;
        const encryptOption = this.db.options.encryptOption;
        let data = JSON.stringify(this.queue.queue.tempref || {});
        if (encryptOption.enabled) {
            const HashData = encrypt(data, encryptOption.securitykey);
            data = JSON.stringify(HashData);
        }
        writeFileSync(this.references, data);
    }
    async get(key) {
        let data = this.cache.get(key);
        if (data) {
            return data;
        }
        else {
            if (this.references instanceof Map) {
                const file = this.references.get(key);
                if (!file)
                    return;
                const tempdata = await this._get(key, file);
                if (!tempdata)
                    return;
                data = new Data({ ...tempdata, file });
            }
            else {
                if (!this.queue.queue.tempref)
                    this.queue.queue.tempref = this._getReferenceDataFromFile();
                const file = this.queue.queue.tempref?.[key];
                if (!file)
                    return;
                const tempdata = await this._get(key, file);
                if (!tempdata)
                    return;
                data = new Data({ ...tempdata, file });
                const refTimeout = setTimeout(() => {
                    delete this.queue.queue.tempref;
                    clearTimeout(refTimeout);
                }, 5000);
            }
        }
        return data;
    }
    async _get(key, file) {
        const encryptOption = this.db.options.encryptOption;
        if (!this.queue.queued.get) {
            this.queue.queued.get = true;
            const timeout = setTimeout(() => {
                this.queue.queue.get.clear();
                this.queue.queued.get = false;
                clearTimeout(timeout);
            }, this.db.options.methodOption.getTime);
        }
        if (!this.queue.queue.get.get(file)) {
            let readData = readFileSync(`${this.path}/${file}`).toString();
            if (encryptOption.enabled) {
                const HashData = JSONParser(readData);
                if (!HashData.iv)
                    return;
                readData = decrypt(HashData, encryptOption.securitykey);
            }
            const JSONData = JSONParser(readData);
            this.queue.queue.get.set(file, JSONData);
            return JSONData[key];
        }
        else {
            return this.queue.queue.get.get(file)?.[key];
        }
    }
    async all(filter, limit = 10, sortType = "desc") {
        limit =
            limit === Infinity
                ? Object.values(this.routers).reduce((a, b) => a + b)
                : limit;
        let res = [];
        const encryptOption = this.db.options.encryptOption;
        if (this.queue.queued.all) {
            if (!filter) {
                res = [...this.queue.queue.all.data.values()];
                res =
                    sortType === "desc"
                        ? res.slice(0, limit)
                        : res.reverse().slice(0, limit);
                return res;
            }
            else {
                res = this.queue.queue.all.filter((_, key) => filter(key));
                res =
                    sortType === "desc"
                        ? res.slice(0, limit)
                        : res.reverse().slice(0, limit);
                return res;
            }
        }
        else {
            const referenceSize = await this.getReferenceSize();
            if (referenceSize <= this.db.options.cacheOption.limit &&
                referenceSize <= this.db.options.storeOption.maxDataPerFile) {
                return filter ? [...this.cache.data.values()].filter((_) => filter(_.key)) : [...this.cache.data.values()];
            }
            this.queue.queued.all = true;
            this.files.forEach((file) => {
                const readData = readFileSync(`${this.path}/${file}`).toString();
                let JSONData;
                if (encryptOption.enabled) {
                    const HashData = JSONParser(readData);
                    if (!HashData.iv) {
                        JSONData = {};
                    }
                    else {
                        JSONData = JSONParser(decrypt(HashData, encryptOption.securitykey));
                    }
                }
                else {
                    JSONData = JSONParser(readData);
                }
                const keys = Object.keys(JSONData);
                for (const key of keys) {
                    const data = new Data({ ...JSONData[key], file });
                    this.queue.queue.all.manualSet(key, data);
                }
            });
            this.queue.queue.all.sort();
            const timeout = setTimeout(() => {
                this.queue.queue.all.clear();
                this.queue.queued.all = false;
                clearTimeout(timeout);
            }, this.db.options.methodOption.allTime);
            if (!filter) {
                res = [...this.queue.queue.all.data.values()];
                res =
                    sortType === "desc"
                        ? res.slice(0, limit)
                        : res.reverse().slice(0, limit);
                return res;
            }
            else {
                res = this.queue.queue.all.filter((_, key) => filter(key));
                res =
                    sortType === "desc"
                        ? res.slice(0, limit)
                        : res.reverse().slice(0, limit);
                return res;
            }
        }
    }
    async delete(key) {
        let file;
        if (this.references instanceof Map) {
            file = this.references.get(key);
            if (!file)
                return;
        }
        else {
            const ref = this._getReferenceDataFromFile();
            file = ref?.[key];
        }
        if (!file)
            file = (await this.get(key))?.file;
        if (!file)
            return;
        if (!this.queue.queue.delete.get(file)) {
            this.queue.queue.delete.set(file, new Set());
        }
        this.cache.delete(key);
        this.queue.addToQueue("delete", file, key);
        if (!this.queue.queued.delete) {
            this.queue.queued.delete = true;
            const timeout = setTimeout(async () => {
                await this._deleteUpdate();
                this.queue.queued.delete = false;
                clearTimeout(timeout);
            }, this.db.options.methodOption.deleteTime);
        }
    }
    async _deleteUpdate() {
        const encryptOption = this.db.options.encryptOption;
        const files = this.queue.queue.delete;
        for (const [file, mapData] of files) {
            let readData = (await readFile(`${this.path}/${file}`)).toString();
            if (encryptOption.enabled) {
                const HashData = JSONParser(readData);
                if (HashData.iv) {
                    readData = decrypt(HashData, encryptOption.securitykey);
                }
                else {
                    readData = "{}";
                }
            }
            const JSONData = JSONParser(readData);
            for (const key of mapData) {
                this.deleteReference(key);
                delete JSONData[key];
            }
            if (Object.keys(JSONData).length === 0) {
                await rm(`${this.path}/${file}`, {
                    recursive: true,
                });
                const indexof = this.files.indexOf(file);
                this.files.splice(indexof, 1);
                if (this.files.length === 0) {
                    this._createNewFile();
                }
            }
            else {
                let writeData = JSON.stringify(JSONData);
                if (encryptOption.enabled) {
                    if (Object.keys(writeData).length === 0) {
                        writeData = "{}";
                    }
                    else {
                        writeData = JSON.stringify(encrypt(writeData, encryptOption.securitykey));
                    }
                }
                await writeFile(`${this.path}/$temp_${file}`, writeData);
                await rm(`${this.path}/${file}`);
                await rename(`${this.path}/$temp_${file}`, `${this.path}/${file}`);
            }
            this.queue.deletePathFromQueue("delete", file);
        }
        this._createReferencePath();
    }
    deleteReference(key) {
        if (this.references instanceof Map) {
            this.references.delete(key);
        }
        else {
            if (this.queue.queue.tempref)
                delete this.queue.queue.tempref[key];
        }
    }
    clear() {
        this.cache.clear();
        this.queue.queue.tempref = {};
        rmSync(this.path, {
            recursive: true,
        });
        this.files = [];
        mkdirSync(this.path, {
            recursive: true,
        });
        this._createNewFile();
        this._createReferencePath();
    }
    getPing() {
        if (this.#ping !== -1 && Date.now() - this.#lastPingTimestamp < 60000)
            return this.#ping;
        else if (this.#ping === -1 ||
            Date.now() - this.#lastPingTimestamp > 60000) {
            const randomFile = this.files[Math.floor(Math.random() * this.files.length)];
            const encryptOption = this.db.options.encryptOption;
            const start = Date.now();
            const file = readFileSync(`${this.path}/${randomFile}`).toString();
            if (encryptOption.enabled) {
                const HashData = JSONParser(file);
                if (!HashData.iv) {
                    this.#ping = Date.now() - start;
                    this.#lastPingTimestamp = Date.now();
                    return this.#ping;
                }
                else {
                    const descryptData = decrypt(HashData, encryptOption.securitykey);
                }
            }
            this.#ping = Date.now() - start;
            this.#lastPingTimestamp = Date.now();
            return this.#ping;
        }
        else {
            return this.#ping;
        }
    }
    async getDataFromFile(fileNumber) {
        const file = `${this.name}_scheme_${fileNumber}${this.db.options.extension}`;
        const encryptOption = this.db.options.encryptOption;
        const readData = (await readFile(`${this.path}/${file}`)).toString();
        if (encryptOption.enabled) {
            const HashData = JSONParser(readData);
            if (HashData.iv) {
                const jsonData = JSONParser(decrypt(HashData, encryptOption.securitykey));
                const keys = Object.keys(jsonData);
                for (const key of keys) {
                    jsonData[key] = new Data({ ...jsonData[key], file });
                }
                return jsonData;
            }
            else {
                const jsonData = JSONParser(readData);
                const keys = Object.keys(jsonData);
                for (const key of keys) {
                    jsonData[key] = new Data({ ...jsonData[key], file });
                }
                return jsonData;
            }
        }
    }
    async setMultiple(...data) {
        let i = 0;
        while (i < data.length) {
            await this.set(data[i].key, data[i].options);
            i++;
        }
    }
    async getReferenceSize() {
        const encryptOption = this.db.options.encryptOption;
        if (typeof this.references === "string") {
            let readData = (await readFile(this.references)).toString();
            if (encryptOption.enabled) {
                const HashData = JSONParser(readData);
                if (HashData.iv) {
                    readData = decrypt(HashData, encryptOption.securitykey);
                }
                else {
                    readData = "{}";
                }
            }
            const JSONData = JSONParser(readData);
            return Object.keys(JSONData).length;
        }
        else {
            return this.references.size;
        }
    }
}
//# sourceMappingURL=table.js.map