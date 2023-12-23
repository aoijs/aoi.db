import { ReferenceType } from "../../index.js";
import WideColumnarColumn from "../src/Column.js";
import WideColumnarData from "../src/Data.js";
import WideColumnar from "../src/Database.js";
import { ColumnType, WideColumnarDataType } from "./types.js";
export interface WideColumnarColumnOptions {
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
}
export interface MemMapOptions {
    limit: number;
    sortFunction: (a: WideColumnarData, b: WideColumnarData) => number;
}
export interface WideColumnarDataInterface {
    name: string;
    value: WideColumnarDataType;
    type: ColumnType;
}
export interface WideColumnarOptions {
    dataConfig?: WideColumnarDataConfig;
    fileConfig?: WideColumnarFileConfig;
    encryptionConfig: WideColumnarEncryptionConfig;
    cacheConfig?: WideColumnarCacheConfig;
    debug?: boolean;
}
export interface WideColumnarDataConfig {
    path?: string;
    tables?: {
        name: string;
        columns: WideColumnarColumnOptions[] | WideColumnarColumn[];
    }[];
    referencePath?: string;
}
export interface WideColumnarFileConfig {
    extension?: string;
}
export interface WideColumnarEncryptionConfig {
    securityKey: string;
}
export interface WideColumnarTableOptions {
    name: string;
    columns: WideColumnarColumnOptions[] | WideColumnarColumn[];
    db: WideColumnar;
}
export interface WideColumnarCacheConfig extends MemMapOptions {
    referenceType: ReferenceType;
}
//# sourceMappingURL=interface.d.ts.map