import { CacherOptions, KeyValueJSONOption } from "../typings/interface.js";
import { Group } from "@akarui/structures";
import Data from "./data.js";
export default class Cacher {
    #private;
    options: CacherOptions;
    constructor(options: CacherOptions);
    set(data: Data): void;
    get(key: string, file: string): Data | undefined;
    delete(key: string, file: string): boolean;
    clear(file: string): void;
    has(key: string, file: string): boolean;
    get size(): Group<string, Data>;
    get data(): Record<string, Group<string, Data>>;
    clearAll(): void;
    getFileCache(file: string): Group<string, Data>;
    replace(file: string, json: Record<string, KeyValueJSONOption>): void;
}
//# sourceMappingURL=cache.d.ts.map