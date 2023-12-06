import { MemMapOptions } from "../typings/interface.js";
import { WideColumnarDataType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnarData from "./Data.js";
export default class MemMap {
    #private;
    heap: WideColumnarData[];
    constructor(options: MemMapOptions, Column: WideColumnarColumn);
    set(data: WideColumnarData): Promise<void>;
    get(column: string, primary: WideColumnarDataType): WideColumnarData | undefined;
    has(column: string, primary: WideColumnarDataType): boolean;
    delete(column: string, primary: WideColumnarDataType): void;
    getHeap(): WideColumnarData[];
    getOptions(): MemMapOptions;
    getSize(): number;
    flush(): Promise<void>;
}
//# sourceMappingURL=MemMap.d.ts.map