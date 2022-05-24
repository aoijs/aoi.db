import { TypedEmitter } from "tiny-typed-emitter";
import ws from "ws";
import { TransmitterFlags } from "../../typings/enums.js";
import { ColumnTableOptions, ReceiverOptions, SocketData, WsEvents } from "../../typings/interface.js";
export declare class Receiver extends TypedEmitter<WsEvents> {
    #private;
    logData: {
        currentLogFile: string;
        logs: Record<string, string>;
        path: string;
        key: string;
    };
    connection: ws.Server;
    options: ReceiverOptions;
    clients: Map<`${string}:${string}`, SocketData>;
    _ping: number;
    lastPingTimestamp: number;
    _currentSequence: number;
    constructor(options: ReceiverOptions);
    connect(): void;
    load(socket: string, { tables, flags, }: {
        tables: string[] | ColumnTableOptions[];
        flags: TransmitterFlags;
    }): void;
    logSequence(socket: string, sequence: number, data: object): void;
}
//# sourceMappingURL=database.d.ts.map