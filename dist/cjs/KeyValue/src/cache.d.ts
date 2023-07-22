import { CacherOptions, KeyValueJSONOption } from "../typings/interface.js";
export default class Cacher {
    options: CacherOptions;
    data: Record<string, Map<string, KeyValueJSONOption>>;
    size: number;
    constructor(options: CacherOptions);
    set(key: string, value: KeyValueJSONOption, file: string): void;
    get(key: string, file: string): KeyValueJSONOption | undefined;
    delete(key: string, file: string): boolean | undefined;
    clear(file: string): void;
    has(key: string, file: string): boolean | undefined;
    clearAll(): void;
    replace(file: string, data: Record<string, KeyValueJSONOption>): void;
    toJSON(file: string): {
        [k: string]: KeyValueJSONOption;
    };
    getFileCache(file: string): Map<string, KeyValueJSONOption>;
}
//# sourceMappingURL=cache.d.ts.map