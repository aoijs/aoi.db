import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { TransmitterFlags } from "../../typings/enums.js";
import { ColumnTableOptions, ReceiverOptions, WsEvents } from "../../typings/interface.js";
export declare class Receiver extends TypedEmitter<WsEvents> {
    connection: ws.Server;
    options: ReceiverOptions;
    clients: Map<string, {
        tables?: string[] | ColumnTableOptions[];
        flags?: TransmitterFlags;
    }>;
    _ping: number;
    lastPingTimestamp: number;
    _currentSequence: number;
    db: KeyValue | WideColumn;
    databaseType: "KeyValue" | "WideColumn";
    constructor(options: ReceiverOptions);
    connect(): void;
    load(socket: string, { tables, flags, }: {
        tables: string[] | ColumnTableOptions[];
        flags: TransmitterFlags;
    }): void;
}
//# sourceMappingURL=database.d.ts.map