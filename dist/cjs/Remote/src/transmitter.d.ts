/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "events";
import { Socket } from "net";
import { ReceiverDataFormat, TransmitterCreateOptions, TransmitterOptions } from "../typings/interface.js";
import { DatabaseMethod } from "../../typings/enum.js";
import { KeyValue, KeyValueData } from "../../index.js";
export default class Transmitter<Database extends KeyValue> extends EventEmitter {
    #private;
    client: Socket;
    options: TransmitterOptions;
    data: {
        seq: number;
        lastPingTimestamp: number;
        ping: number;
    };
    readyAt: number;
    constructor(options: TransmitterOptions);
    static createConnection(options: TransmitterCreateOptions): Transmitter<KeyValue>;
    receiveDataFormat(buffer: Buffer): ReceiverDataFormat;
    sendDataFormat(method: DatabaseMethod, timestamp: number, seq: number, data?: unknown): Buffer;
    ping(): void;
    get(table: string, key: Database extends KeyValue ? string : never): Promise<Database extends KeyValue ? KeyValueData : never>;
    set(table: string, key: Database extends KeyValue ? string : never, value: Database extends KeyValue ? KeyValueData : never): Promise<void>;
    delete(table: string, key: Database extends KeyValue ? string : never): Promise<void>;
    clear(table: string): Promise<void>;
    all(table: string, query?: (value: Database extends KeyValue ? KeyValueData : never, index: number) => boolean, limit?: number): Promise<Database extends KeyValue ? KeyValueData[] : never>;
    has(table: string, key: Database extends KeyValue ? string : never): Promise<boolean>;
}
//# sourceMappingURL=transmitter.d.ts.map