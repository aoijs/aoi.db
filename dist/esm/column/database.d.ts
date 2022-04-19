import { TypedEmitter } from "tiny-typed-emitter";
import { ColumnDatabaseOptions, ColumnTableOptions, TypedDatabaseEvents } from "../typings/interface.js";
import { CacheReferenceType, WideColumnDataValueType } from "../typings/type.js";
import { WideColumnMemMap } from "./cacher.js";
import { WideColumnData } from "./data.js";
import { WideColumnTable } from "./table.js";
export declare class WideColumn extends TypedEmitter<TypedDatabaseEvents> {
    tables: Map<string, WideColumnTable>;
    options: {
        cacheOption: {
            cacheReference: CacheReferenceType;
            limit: number;
            sorted: boolean;
        };
        extension: string;
        methodOption: {
            getTime: number;
            deleteTime: number;
        };
        path: string;
        storeOption: {
            maxDataPerFile: number;
        };
        tables: ColumnTableOptions[];
        encryptOption: {
            securitykey: string;
        };
    };
    constructor(options: ColumnDatabaseOptions);
    _resolve(options: ColumnDatabaseOptions): {
        cacheOption: {
            cacheReference: CacheReferenceType;
            limit: number;
            sorted: boolean;
        };
        extension: string;
        methodOption: {
            getTime: number;
            deleteTime: number;
        };
        path: string;
        storeOption: {
            maxDataPerFile: number;
        };
        tables: ColumnTableOptions[];
        encryptOption: {
            securitykey: string;
        };
    };
    get securitykey(): string;
    connect(): void;
    set(table: string, columnData: {
        name: string;
        value: WideColumnDataValueType;
    }, primaryColumnData: {
        name: string;
        value: WideColumnDataValueType;
    }): Promise<void>;
    get(table: string, column: string, primary: WideColumnDataValueType): Promise<string | number | bigint | boolean | object | null | undefined>;
    delete(table: string, column: string, primary: WideColumnDataValueType): Promise<void>;
    all(table: string, column: string, filter: (value: WideColumnData, key?: WideColumnDataValueType, cacher?: WideColumnMemMap) => boolean, limit?: number): Promise<WideColumnData[] | undefined>;
    getAllData(table: string, column: string): Promise<WideColumnMemMap>;
    get ping(): number;
    tablePing(table: string): number;
    getTransactionLog(table: string, column: string): Promise<string>;
    allData(table: string): Promise<any[]>;
    clearTable(table: string): void;
    clearColumn(table: string, column: string): void;
    clear(): void;
    disconnect(): void;
    bulkSet(table: string, ...data: [
        secondaryColumnData: {
            name: string;
            value: WideColumnDataValueType;
        },
        primaryColumnData: {
            name: string;
            value: WideColumnDataValueType;
        }
    ][]): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map