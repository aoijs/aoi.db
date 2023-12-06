import { CacherOptions, KeyValueJSONOption } from "../typings/interface.js";
import {Group} from "@akarui/structures";
import Data from "./data.js";


export default class Cacher {
    options: CacherOptions;
    #data: Record<string,Group<string,Data>>;
    constructor(options: CacherOptions) {
        this.options = options;
        this.#data = {}
    }
      set(data:Data) {
        if(!this.#data[data.file]) this.#data[data.file] = new Group(this.options.limit);
        this.#data[data.file].set(data.key,data);
    }
    get(key:string ,file:string) {
        if(!this.#data[file]) return;
        return this.#data[file].get(key);
    }
    delete(key: string , file:string) {
        if(!this.#data[file]) return false;
        return this.#data[file].delete(key);
        
    }
    clear(file:string) {
        if(!this.#data[file]) return;
        return this.#data[file].clear();
    }
    has(key: string , file:string) {
        if(!this.#data[file]) return false;
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
    getFileCache(file:string) {
        return this.#data[file];
    }
    replace(file:string,json:Record<string,KeyValueJSONOption>) {
        if(!this.#data[file]) this.#data[file] = new Group(this.options.limit);
        this.#data[file].clear();
        for(const key in json) {
            const data = new Data({
                key,
                file,
                value: json[key].value,
                type: json[key].type,
            });
            this.#data[file].set(key,data);
        }
    }
}