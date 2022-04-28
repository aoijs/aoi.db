import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumnMemMap } from "../../column/cacher.js";
import { Cacher } from "../../keyvalue/cacher.js";
import { WsEvents, TransmitterOptions } from "../../typings/interface.js";
import { WideColumnDataValueType } from "../../typings/type.js";
export declare class Transmitter extends TypedEmitter<WsEvents> {
    connection: ws;
    cache?: Cacher | Map<WideColumnDataValueType, WideColumnMemMap>;
    options: TransmitterOptions;
    _ping: number;
    lastPingTimestamp: number;
    sequence: number;
    databaseType: "KeyValue" | "WideColumn" | "Relational";
    constructor(options: TransmitterOptions);
    connect(): void;
    set(table: string, key: unknown, data: unknown): Promise<unknown>;
    get(table: string, key: WideColumnDataValueType, id?: WideColumnDataValueType): Promise<unknown>;
    delete(table: string, key: WideColumnDataValueType, primary: WideColumnDataValueType): void;
    all(table: string, { filter, limit, column, }?: {
        filter?: (...args: any) => boolean;
        limit?: number;
        column?: string;
    }): Promise<unknown>;
    get ping(): number;
}
//# sourceMappingURL=database.d.ts.map