import { Group } from "@akarui/structures";
import { MemMapOptions } from "../typings/interface.js";
import { ColumnDataType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnarData from "./Data.js";
export default class MemMap {
    #private;
    heap: Group<WideColumnarData['primary']['value'], WideColumnarData>;
    constructor(options: MemMapOptions, Column: WideColumnarColumn);
    set(data: WideColumnarData): Promise<void>;
    get(primary: ColumnDataType): WideColumnarData | undefined;
    has(primary: ColumnDataType): boolean;
    delete(primary: ColumnDataType): boolean;
    getHeap(): Group<ColumnDataType, WideColumnarData>;
    getOptions(): MemMapOptions;
    getSize(): number;
    flush(): Promise<void>;
    findOne(query: (data: WideColumnarData) => boolean): WideColumnarData | undefined;
    findMany(query: (data: WideColumnarData) => boolean): Group<ColumnDataType, WideColumnarData>;
}
//# sourceMappingURL=MemMap.d.ts.map