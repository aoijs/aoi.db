import { TypedEmitter } from "tiny-typed-emitter";
import { KeyValueDatabaseOption, KeyValueDataOption, TypedDatabaseEvents } from "../typings/interface.js";
import { CacheReferenceType } from "../typings/type.js";
import { Table } from "./table.js";
export declare class KeyValue extends TypedEmitter<TypedDatabaseEvents> {
    tables: Map<string, Table>;
    options: {
        path: string;
        extension: string;
        tables: string[];
        cacheOption: {
            cacheReference: CacheReferenceType;
            limit: number;
            sorted: boolean;
        };
        encryptOption: {
            enabled: boolean;
            securitykey: string;
        };
        methodOption: {
            allTime: number;
            deleteTime: number;
            getTime: number;
            saveTime: number;
        };
        storeOption: {
            maxDataPerFile: number;
        };
    };
    ready: boolean;
    readyTimestamp: number;
    constructor(options: KeyValueDatabaseOption);
    _resolve(options: KeyValueDatabaseOption): {
        path: string;
        extension: string;
        tables: string[];
        cacheOption: {
            cacheReference: CacheReferenceType;
            limit: number;
            sortOrder: "ASC" | "DESC";
            sorted: boolean;
        };
        encryptOption: {
            enabled: boolean;
            securitykey: string;
        };
        methodOption: {
            allTime: number;
            deleteTime: number;
            getTime: number;
            saveTime: number;
        };
        storeOption: {
            maxDataPerFile: number;
        };
    };
    connect(): void;
    set(table: string, key: string, value: KeyValueDataOption): Promise<void>;
    get(table: string, key: string): Promise<import("./data.js").Data | undefined>;
    delete(table: string, key: string): Promise<void>;
    clear(table: string): void;
    all(table: string, filter?: (key?: string) => boolean, limit?: number, sortType?: "asc" | "desc"): Promise<import("./data.js").Data[]>;
    get ping(): number;
    tablePing(table: string): number;
    _debug(header: string, msg: string): void;
    bulkSet(table: string, ...data: {
        key: string;
        options: KeyValueDataOption;
    }[]): Promise<void>;
    disconnect(): void;
}
//# sourceMappingURL=database.d.ts.map