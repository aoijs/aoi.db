import { WideColumnarTableOptions } from "../typings/interface.js";
import { ColumnType, WideColumnarDataType } from "../typings/types.js";
import WideColumnarColumn from "./Column.js";
import WideColumnar from "./Database.js";
import WideColumnarData from "./Data.js";
export default class WideColumnarTable {
    #private;
    name: string;
    columns: WideColumnarColumn[];
    options: any;
    constructor(options: WideColumnarTableOptions);
    get db(): WideColumnar;
    connect(): Promise<void>;
    get primary(): {
        name: string;
        type: ColumnType;
    };
    set(column: {
        name: string;
        value: any;
    }, primary: {
        name: string;
        value: any;
    }): Promise<void>;
    get(columnName: string, primary: WideColumnarDataType): Promise<WideColumnarData | null | undefined>;
    delete(columnName: string, primary: WideColumnarDataType): Promise<void>;
    all(columnName: string, query: (row: WideColumnarData) => boolean, limit?: number): Promise<WideColumnarData[]>;
    allColumns(query: (row: WideColumnarData) => boolean, limit?: number): Promise<WideColumnarData[]>;
    findMany(columnName: string, query: (row: WideColumnarData) => boolean): Promise<WideColumnarData[]>;
    findOne(columnName: string, query: (row: WideColumnarData) => boolean): Promise<WideColumnarData | null>;
    deleteMany(columnName: string, query: (row: WideColumnarData) => boolean): Promise<void>;
    has(columnName: string, primary: WideColumnarDataType): Promise<boolean>;
    clear(): Promise<void>;
    clearColumn(columnName: string): Promise<void>;
    fullRepair(): Promise<void>;
}
//# sourceMappingURL=Table.d.ts.map