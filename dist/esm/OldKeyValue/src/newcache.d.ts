import { Group } from "@akarui/structures";
import { CacherOptions, KeyValueJSONOption } from "../typings/interface.js";
import Data from "./data.js";
export default class Cacher<K = string, V = Data> extends Group<K, V> {
    #private;
    constructor(options: CacherOptions);
    bulkFileSet(data: Record<string, KeyValueJSONOption>, file: string): void;
}
//# sourceMappingURL=newcache.d.ts.map