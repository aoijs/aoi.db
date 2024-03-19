import { Group } from "@akarui/structures";
import Data from "./data.js";
export default class Cacher {
    options;
    #data;
    constructor(options) {
        this.options = options;
        this.#data = {};
    }
    set(data) {
        if (!this.#data[data.file])
            this.#data[data.file] = new Group(this.options.limit);
        this.#data[data.file].set(data.key, data);
    }
    get(key, file) {
        if (!this.#data[file])
            return;
        return this.#data[file].get(key);
    }
    delete(key, file) {
        if (!this.#data[file])
            return false;
        return this.#data[file].delete(key);
    }
    clear(file) {
        if (!this.#data[file])
            return;
        return this.#data[file].clear();
    }
    has(key, file) {
        if (!this.#data[file])
            return false;
        return this.#data[file].has(key);
    }
    get size() {
        return this.#data.size;
    }
    get data() {
        return this.#data;
    }
    clearAll() {
        this.#data = {};
    }
    getFileCache(file) {
        return this.#data[file];
    }
    replace(file, json) {
        if (!this.#data[file])
            this.#data[file] = new Group(this.options.limit);
        this.#data[file].clear();
        for (const key in json) {
            const data = new Data({
                key,
                file,
                value: json[key].value,
                type: json[key].type,
            });
            this.#data[file].set(key, data);
        }
    }
}
//# sourceMappingURL=cache.js.map