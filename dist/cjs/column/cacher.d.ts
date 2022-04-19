import { CacherOptions } from "../typings/interface.js";
import { WideColumnDataValueType } from "../typings/type.js";
import { WideColumnData } from "./data.js";
export declare class WideColumnMemMap {
    data: Map<WideColumnDataValueType, WideColumnData>;
    options: CacherOptions;
    constructor(options: CacherOptions, init?: Readonly<Readonly<[WideColumnDataValueType, WideColumnData][]>>);
    top(n?: number): WideColumnData | WideColumnData[];
    bottom(n?: number): WideColumnData | WideColumnData[];
    set(key: WideColumnDataValueType, value: WideColumnData): void;
    get(key: WideColumnDataValueType): WideColumnData | undefined;
    delete(key: WideColumnDataValueType): boolean;
    clear(): void;
    find(func: (val: WideColumnData, k?: WideColumnDataValueType, cacher?: this) => boolean): WideColumnData | undefined;
    filter(func: (val: WideColumnData, k?: WideColumnDataValueType, cacher?: this) => boolean): WideColumnData[];
    some(func: (val: WideColumnData, k: WideColumnDataValueType, cacher: this) => boolean): boolean;
    every(func: (val: WideColumnData, k: WideColumnDataValueType, cacher: this) => boolean): boolean;
    forEach(func: (val: WideColumnData, k: WideColumnDataValueType, cacher: this) => void): void;
    map<U>(func: (val: WideColumnData, k: WideColumnDataValueType, cacher: this) => U): U[];
    sort(): void;
    concat(...map: WideColumnMemMap[]): this;
    deleteDatas(...keys: WideColumnDataValueType[]): this;
    slice(start?: number, end?: number): WideColumnData[];
    random(): WideColumnData;
}
//# sourceMappingURL=cacher.d.ts.map