import ws from "ws";
import { WideColumn } from "../../column/database.js";
import { KeyValue } from "../../keyvalue/database.js";
import { TransmitterFlags } from "../../typings/enums.js";
import { ColumnTableOptions, ReceiverOptions } from "../../typings/interface.js";
export declare class Receiver {
    connection: ws.Server;
    options: ReceiverOptions;
    _ping: number;
    flags: TransmitterFlags;
    lastPingTimestamp: number;
    _currentSequence: number;
    db: KeyValue | WideColumn;
    databaseType: "KeyValue" | "WideColumn";
    constructor(options: ReceiverOptions);
    connect(): void;
    load({ tables, flags, }: {
        tables: string[] | ColumnTableOptions[];
        flags: TransmitterFlags;
    }): void;
}
//# sourceMappingURL=database.d.ts.map