import { WideColumnDataValueType } from "../typings/type.js";
import { WideColumnMemMap } from "./cacher.js";
import { Column } from "./column.js";
import { WideColumnData } from "./data.js";
import { WideColumn } from "./database.js";
import { WideColumnQueue as Queue } from "./queueManager.js";
export declare class WideColumnTable {
    name: string;
    columns: Column[];
    queue: Queue;
    primary: Column;
    db: WideColumn;
    reference: Record<string, Map<WideColumnDataValueType, string>> | string;
    constructor(name: string, columns: Column[], db: WideColumn);
    connect(): Promise<void>;
    set(secondaryColumnData: {
        name: string;
        value: WideColumnDataValueType;
    }, primaryColumnData: {
        name: string;
        value: WideColumnDataValueType;
    }): Promise<void>;
    get logPath(): string;
    get(column: string, primary: WideColumnDataValueType): Promise<string | number | bigint | boolean | object | null | undefined>;
    delete(column: string, primary: WideColumnDataValueType): Promise<boolean | undefined>;
    all(column: string, filter?: (value: WideColumnData, key?: WideColumnDataValueType, cacher?: WideColumnMemMap) => boolean, limit?: number): Promise<WideColumnData[] | undefined>;
    get ping(): number;
    getAllData(column: string): Promise<WideColumnMemMap>;
    getTransactionLog(column: string): Promise<string>;
    allData(): Promise<any[]>;
    clearColumn(column: string): void;
    clear(): void;
    disconnect(): void;
    unloadColumn(column: string): void;
    bulkSet(...data: [
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
//# sourceMappingURL=table.d.ts.map