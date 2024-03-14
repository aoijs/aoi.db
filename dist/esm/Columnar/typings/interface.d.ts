import ColumnData from "../src/Data.js";
import { ColumnDataType, ColumnType } from "./types.js";
export interface ColumnDataInterface {
    name: string;
    type: ColumnType;
    value: ColumnDataType;
}
export interface MemMapOptions {
    limit: number;
    sortFunction: (a: ColumnData, b: ColumnData) => number;
}
//# sourceMappingURL=interface.d.ts.map