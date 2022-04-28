/// <reference types="node" />
import { ClientOptions, ServerOptions } from "ws";
import { Column } from "../column/column.js";
import { Table } from "../keyvalue/table.js";
import { ReceiverOp, TransmitterFlags } from "./enums.js";
import { CacheReferenceType, KeyValueDataValueType, RelationalDataValueType, WideColumnTypes } from "./type.js";
export interface KeyValueDataOption {
    value: KeyValueDataValueType;
    key: string;
    file: string;
    ttl: number;
    type?: string;
}
export interface KeyValueSetDataOption {
    value: KeyValueDataValueType;
    ttl: number;
}
export interface KeyValueJSONOption {
    value: KeyValueDataValueType;
    key: string;
    ttl: number;
    type: string;
}
export interface KeyValueDatabaseOption {
    path?: string;
    extension?: string;
    tables?: string[];
    cacheOption?: {
        limit?: number;
        cacheReference?: CacheReferenceType;
        sortOrder?: "ASC" | "DESC";
        sorted?: boolean;
    };
    storeOption?: {
        maxDataPerFile?: number;
    };
    methodOption?: {
        saveTime?: number;
        getTime?: number;
        allTime?: number;
        deleteTime?: number;
    };
    encryptOption?: {
        enabled?: boolean;
        securitykey?: string;
    };
}
export interface HashData {
    iv: string;
    data: string;
}
export interface RelationalDatabaseOptions {
    path?: string;
    extension?: string;
    tables: RelationalTableOptions;
    encryptOption?: {
        enabled?: boolean;
        securitykey?: string;
    };
    cacheOption?: {
        cacheReference?: CacheReferenceType;
        sorted?: boolean;
        limit?: number;
    };
    methodOption?: {
        saveTime?: number;
        getTime?: number;
        allTime?: number;
        deleteTime?: number;
    };
    storeOption?: {
        maxDataPerFile?: number;
        sorted?: boolean;
    };
}
export interface RelationalTableOptions {
    name: string;
    path: string;
    columnData: ColumnData[];
}
export interface ColumnData {
    name: string;
    primary: boolean;
    defaultValue?: RelationalDataValueType;
    type: RelationalDataValueType;
}
export interface RowData {
    name: string;
    column: string;
    value: RelationalDataValueType;
    file: string;
}
export interface TypedDatabaseEvents {
    ready(): void;
    disconnect(): void;
    tableReady(table: Table): void;
    debug(message: string): void;
}
export interface ColumnDatabaseOptions {
    encryptOption: {
        securitykey: string;
    };
    tables: ColumnTableOptions[];
    path?: string;
    extension?: string;
    cacheOption?: {
        limit?: number;
        cacheReference?: CacheReferenceType;
        sorted?: boolean;
    };
    methodOption?: {
        getTime?: number;
        deleteTime?: number;
    };
    storeOption?: {
        maxDataPerFile?: number;
        sorted?: boolean;
    };
}
export interface ColumnTableOptions {
    name: string;
    columns: Column[];
}
export interface ColumnDbColumnData {
    sortOrder?: "ASC" | "DESC";
    name: string;
    primary: boolean;
    type: WideColumnTypes;
}
export interface CacherOptions {
    limit?: number;
    sortOrder?: "ASC" | "DESC";
    cacheReference?: CacheReferenceType;
    sorted?: boolean;
}
export interface TransmitterOptions {
    flags: TransmitterFlags.READ_ONLY | TransmitterFlags.READ_WRITE | TransmitterFlags.WRITE_ONLY;
    path: string;
    wsOptions: ClientOptions;
    tables: (string | ColumnTableOptions | RelationalTableOptions)[];
    type: "KeyValue" | "Relational" | "WideColumn";
    cacheOption?: {
        limit?: number;
    };
}
export interface ReceiverData {
    op: ReceiverOp;
    data: any;
    databaseType: "KeyValue" | "WideColumn" | "Relational";
    sequence: number;
    timestamp: number;
}
export interface ColumnTableOptions {
    name: string;
    columns: Column[];
}
export interface ColumnDbColumnData {
    sortOrder?: "ASC" | "DESC";
    name: string;
    primary: boolean;
    type: WideColumnTypes;
}
export interface CacherOptions {
    limit?: number;
    sortOrder?: "ASC" | "DESC";
    cacheReference?: CacheReferenceType;
    sorted?: boolean;
}
export interface ReceiverOptions {
    whitelistedIps: "*" | string[];
    databaseType: "KeyValue" | "WideColumn";
    path: string;
    wsOptions: ServerOptions;
    tables: (string | ColumnTableOptions | RelationalTableOptions)[];
    type: "KeyValue" | "Relational" | "WideColumn";
    cacheOption?: {
        limit?: number;
    };
    dbOptions: KeyValueDatabaseOption | ColumnDatabaseOptions;
}
export interface WsEvents {
    ready(): void;
    disconnect(): void;
    debug(message: string): void;
    message(message: ReceiverData): void;
    open(): void;
    close(code: number, reason?: Buffer): void;
    error(error: Error): void;
    connect(): void;
}
//# sourceMappingURL=interface.d.ts.map