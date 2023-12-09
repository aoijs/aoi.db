/// <reference types="node" />
import EventEmitter from "events";
import { DeepRequired, WideColumnarDataType } from "../../index.js";
import { WideColumnarOptions } from "../typings/interface.js";
import WideColumnarTable from "./Table.js";
import WideColumnarData from "./Data.js";
export default class WideColumnar extends EventEmitter {
    #private;
    tables: {
        [key: string]: {
            ready: boolean;
            table: WideColumnarTable;
        };
    };
    readyAt: number;
    constructor(options: WideColumnarOptions);
    get options(): DeepRequired<WideColumnarOptions>;
    static defaultOptions: Required<WideColumnarOptions>;
    connect(): Promise<void>;
    getTable(name: string): WideColumnarTable;
    set(table: string, column: {
        name: string;
        value: any;
    }, primary: {
        name: string;
        value: any;
    }): Promise<void>;
    get(table: string, columnName: string, primary: WideColumnarDataType): Promise<WideColumnarData | null | undefined>;
    delete(table: string, columnName: string, primary: WideColumnarDataType): Promise<void>;
    all(table: string, columnName: string, query: (data: WideColumnarData) => boolean): Promise<WideColumnarData[]>;
    allColumns(table: string, query: (data: WideColumnarData) => boolean): Promise<WideColumnarData[]>;
    allTable(query: (data: WideColumnarData) => boolean): Promise<WideColumnarData[]>;
    clear(table: string): Promise<void>;
    clearAll(): Promise<void>;
    deleteMany(table: string, columnName: string, query: (data: WideColumnarData) => boolean): Promise<void>;
    findMany(table: string, columnName: string, query: (data: WideColumnarData) => boolean): Promise<WideColumnarData[]>;
    findOne(table: string, columnName: string, query: (data: WideColumnarData) => boolean): Promise<WideColumnarData | null>;
    has(table: string, columnName: string, primary: WideColumnarDataType): Promise<boolean>;
    fullRepair(table: string): Promise<void>;
    backup(): void;
}
//# sourceMappingURL=Database.d.ts.map