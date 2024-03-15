import { Group } from "@akarui/structures";
import { CacherOptions, KeyValueJSONOption } from "../index.js";
import Data from "./data.js";
export default class Cacher<K = string, V = Data> extends Group<K, V> {
    #private;
    constructor(options: CacherOptions);
    bulkFileSet(data: Record<string, KeyValueJSONOption>, file: string): void;
    removeDuplicates(): void;
}
//# sourceMappingURL=newcache.d.ts.map