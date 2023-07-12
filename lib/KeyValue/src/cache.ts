import { CacherOptions, KeyValueJSONOption } from "../typings/interface.js";

export default class Cacher {
    options: CacherOptions;
    data: Record<string, Map<string,KeyValueJSONOption>>;
    size: number;
    constructor(options: CacherOptions) {
        this.options = options;
        this.data = {};
        this.size = -1;
    }
    set(key: string, value: KeyValueJSONOption,file:string) {
        if (!this.data[file]) this.data[file] = new Map();
        this.data[file].set(key, value);
    }
    get(key: string,file:string) {
        if (!this.data[file]) return undefined;
        return this.data[file].get(key);
    }
    delete(key: string,file:string) {
        if (!this.data[file]) return undefined;
        return this.data[file].delete(key);
    }
    clear(file:string) {
        if (!this.data[file]) return undefined;
        return this.data[file].clear();
    }
    has(key: string,file:string) {
        if (!this.data[file]) return undefined;
        return this.data[file].has(key);
    }
    clearAll() {
        this.data = {};
    }
    replace(file:string,data:Record<string,KeyValueJSONOption>){
        this.data[file] = new Map(Object.entries(data));
    }
    toJSON(file:string) {
        if (!this.data[file]) return {};
        return Object.fromEntries(this.data[file]);
    }
    getFileCache(file:string){
        return this.data[file];
    }
    
}