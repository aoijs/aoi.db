import { CacherOptions } from "../typings/interface.js";
import { Data } from "./data.js";
export declare class Cacher {
    data: Map<string, Data>;
    options: CacherOptions;
    constructor(options: CacherOptions, init?: Readonly<Readonly<[string, Data][]>>);
    top(n?: number): Data | Data[];
    bottom(n?: number): Data | Data[];
    set(key: string, value: Data): this | undefined;
    manualSet(key: string, value: Data): void;
    get(key: string): Data | undefined;
    delete(key: string): boolean;
    clear(): void;
    find(func: (val: Data, k?: string, cacher?: this) => boolean): Data | undefined;
    filter(func: (val: Data, k?: string, cacher?: this) => boolean): Data[];
    some(func: (val: Data, k: string, cacher: this) => boolean): boolean;
    every(func: (val: Data, k: string, cacher: this) => boolean): boolean;
    forEach(func: (val: Data, k: string, cacher: this) => void): void;
    map<U>(func: (val: Data, k: string, cacher: this) => U): U[];
    sort(): void;
}
//# sourceMappingURL=cacher.d.ts.map