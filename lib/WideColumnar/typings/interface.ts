import { ColumnType } from "./types.js";

export interface WideColumnarColumnOptions {
    name: string;
    primaryKey: boolean;
    default: any;
    type: ColumnType;
}

export interface MemMapOptions {
    limit: number;
}