import { Group } from "@aoijs/aoi.structures";
import { CacherOptions,  KeyValueJSONOption } from "../index.js";
import Data from "./data.js";

export default class Cacher<K = string, V = Data> extends Group<K, V> {
    #cacherOptions: CacherOptions;
    constructor(options: CacherOptions) {
        super(options.limit);
        this.#cacherOptions = options;
    }
    bulkFileSet(data: Record<string, KeyValueJSONOption>, file: string) {
        for (const key in data) {
            const d = new Data({
                ...data[key],
                file,
            });
            this.set(key as K, d as V);
        }
    }
    removeDuplicates() {
        const arr = this.V() as unknown as Data[];
        this.clear();
        for(const data of arr) {
            this.set(data.key as K, data as V);
        }
    }
}
