/// <reference types="node" />
import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumnMemMap } from "../../column/cacher.js";
import { Cacher } from "../../keyvalue/cacher.js";
import { WsEvents, TransmitterOptions, ReceiverData, KeyValueJSONOption } from "../../typings/interface.js";
import { WideColumnDataValueType } from "../../typings/type.js";
export declare class Transmitter extends TypedEmitter<WsEvents> {
    #private;
    connection: ws;
    cache?: Cacher | Map<WideColumnDataValueType, WideColumnMemMap>;
    options: TransmitterOptions;
    _ping: number;
    lastPingTimestamp: number;
    sequence: number;
    databaseType: "KeyValue" | "WideColumn" | "Relational";
    pingTimeout: NodeJS.Timer;
    constructor(options: TransmitterOptions);
    connect(): void;
    _set(table: string, key: unknown, data: KeyValueJSONOption | WideColumnDataValueType): Promise<ReceiverData>;
    _get(table: string, key: WideColumnDataValueType, id?: WideColumnDataValueType): Promise<ReceiverData>;
    _delete(table: string, key: WideColumnDataValueType, primary: WideColumnDataValueType): Promise<ReceiverData>;
    _all(table: string, { filter, limit, column, sortOrder, }?: {
        filter?: (...args: any) => boolean;
        limit?: number;
        column?: string;
        sortOrder?: "asc" | "desc";
    }): Promise<ReceiverData>;
    _clear(table: string, column?: string): Promise<ReceiverData>;
    get ping(): number;
    analyze(method: "set" | "get" | "all" | "delete" | "clear", data: any): Promise<any>;
    set(table: string, key: unknown, data: KeyValueJSONOption | WideColumnDataValueType): Promise<any>;
    get(table: string, key: WideColumnDataValueType, id?: WideColumnDataValueType): Promise<any>;
    delete(table: string, key: WideColumnDataValueType, primary: WideColumnDataValueType): Promise<any>;
    all(table: string, { filter, limit, column, sortOrder, }?: {
        filter?: (...args: any) => boolean;
        limit?: number;
        column?: string;
        sortOrder?: "asc" | "desc";
    }): Promise<any>;
    clear(table: string, column?: string): Promise<any>;
}
//# sourceMappingURL=database.d.ts.map