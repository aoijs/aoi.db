/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "events";
import { Socket } from "net";
import { ReceiverDataFormat, TransmitterCreateOptions, TransmitterOptions, TransmitterAnaylzeDataFormat } from "../typings/interface.js";
import { Key, PossibleDatabaseTypes, TransmitterQuery, Value } from "../typings/type.js";
import { DatabaseMethod } from "../../typings/enum.js";
import { KeyValueData } from "../../index.js";
import { TransmitterOpCodes } from "../typings/enum.js";
export default class Transmitter<Type extends PossibleDatabaseTypes> extends EventEmitter {
    #private;
    client: Socket;
    options: TransmitterOptions<Type>;
    data: {
        seq: number;
        lastPingTimestamp: number;
        ping: number;
    };
    pingInterval: NodeJS.Timeout | null;
    readyAt: number;
    constructor(options: TransmitterOptions<Type>);
    static createConnection<Type extends PossibleDatabaseTypes>(options: TransmitterCreateOptions<Type>): Transmitter<Type>;
    connect(): void;
    receiveDataFormat(buffer: Buffer): ReceiverDataFormat;
    sendDataFormat(op: TransmitterOpCodes, method: DatabaseMethod, timestamp: number, seq: number, data?: unknown): Buffer;
    ping(): void;
    get(table: string, key: Key<Type>): Promise<Value<Type>>;
    set(table: string, key: Key<Type>, value: Value<Type>): Promise<any>;
    delete(table: string, key: Key<Type>): Promise<any>;
    clear(table: string): Promise<void>;
    all(table: string, query?: TransmitterQuery, limit?: number): Promise<Type extends "KeyValue" ? KeyValueData[] : never>;
    has(table: string, key: Key<Type>): Promise<boolean>;
    findOne(table: string, query: TransmitterQuery): Promise<Type extends "KeyValue" ? KeyValueData : never>;
    findMany(table: string, query: TransmitterQuery): Promise<any>;
    deleteMany(table: string, query: TransmitterQuery): Promise<any>;
    analyze(table: string, data: TransmitterAnaylzeDataFormat): Promise<{
        opCode: number;
        method: string;
        timestamp: number;
        seq: number;
        data: {
            value: any;
            delay: {
                toServer: number;
                toClient: number;
                ping: number;
            };
        };
        cost: number;
        hash: string;
    }>;
}
//# sourceMappingURL=transmitter.d.ts.map