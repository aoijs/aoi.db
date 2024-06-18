import { WideColumnarColumnOptions } from "../typings/interface.js";
import { ColumnType, WideColumnarDataType } from "../typings/types.js";
import MemMap from "./MemMap.js";
import WideColumnarTable from "./Table.js";
import WideColumnarData from "./Data.js";
import WideColumnarReferencer from "./Referencer.js";
export default class WideColumnarColumn {
    #private;
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
    path: string;
    files: string[];
    table: WideColumnarTable;
    memMap: MemMap;
    referencer: WideColumnarReferencer;
    repairMode: boolean;
    constructor(options: WideColumnarColumnOptions);
    setPath(path: string): void;
    setFiles(): void;
    setTable(table: WideColumnarTable): void;
    initialize(): Promise<void>;
    flush(data: WideColumnarData[]): Promise<void>;
    set(primary: WideColumnarDataType, value: WideColumnarDataType): Promise<void>;
    get(primary: WideColumnarDataType): Promise<WideColumnarData | null | undefined>;
    has(primary: WideColumnarDataType): Promise<boolean>;
    delete(primary: WideColumnarDataType): Promise<void>;
    clear(): Promise<void>;
    getHeap(): Promise<import("@aoijs/aoi.structures").Group<WideColumnarDataType, WideColumnarData>>;
    findOne(query: (data: WideColumnarData) => boolean): Promise<WideColumnarData | null>;
    findMany(query: (data: WideColumnarData) => boolean): Promise<WideColumnarData[]>;
    deleteMany(query: (data: WideColumnarData) => boolean): Promise<void>;
    all(query: (data: WideColumnarData) => boolean, limit?: number): Promise<WideColumnarData[]>;
    fullRepair(): Promise<void>;
}
//# sourceMappingURL=Column.d.ts.map