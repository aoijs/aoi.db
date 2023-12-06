"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const structures_1 = require("@akarui/structures");
const data_js_1 = __importDefault(require("./data.js"));
class Cacher {
    options;
    #data;
    constructor(options) {
        this.options = options;
        this.#data = {};
    }
    set(data) {
        if (!this.#data[data.file])
            this.#data[data.file] = new structures_1.Group(this.options.limit);
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
            this.#data[file] = new structures_1.Group(this.options.limit);
        this.#data[file].clear();
        for (const key in json) {
            const data = new data_js_1.default({
                key,
                file,
                value: json[key].value,
                type: json[key].type,
            });
            this.#data[file].set(key, data);
        }
    }
}
exports.default = Cacher;
//# sourceMappingURL=cache.js.map