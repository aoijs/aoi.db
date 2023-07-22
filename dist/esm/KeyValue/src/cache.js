export default class Cacher {
    options;
    data;
    size;
    constructor(options) {
        this.options = options;
        this.data = {};
        this.size = -1;
    }
    set(key, value, file) {
        if (!this.data[file])
            this.data[file] = new Map();
        this.data[file].set(key, value);
    }
    get(key, file) {
        if (!this.data[file])
            return undefined;
        return this.data[file].get(key);
    }
    delete(key, file) {
        if (!this.data[file])
            return undefined;
        return this.data[file].delete(key);
    }
    clear(file) {
        if (!this.data[file])
            return undefined;
        return this.data[file].clear();
    }
    has(key, file) {
        if (!this.data[file])
            return undefined;
        return this.data[file].has(key);
    }
    clearAll() {
        this.data = {};
    }
    replace(file, data) {
        this.data[file] = new Map(Object.entries(data));
    }
    toJSON(file) {
        if (!this.data[file])
            return {};
        return Object.fromEntries(this.data[file]);
    }
    getFileCache(file) {
        return this.data[file];
    }
}
//# sourceMappingURL=cache.js.map