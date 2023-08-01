/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "node:events";
import { Server } from "node:net";
import { ReceiverOptions, TransmitterDataFormat } from "../typings/interface.js";
import { DatabaseMethod, KeyValue } from "../../index.js";
import { ReceiverOpCodes } from "../typings/enum.js";
export default class Receiver extends EventEmitter {
    #private;
    server: Server;
    options: ReceiverOptions;
    allowList: Set<string>;
    connections: Map<string, KeyValue>;
    constructor(options: ReceiverOptions);
    allowAddress(address: string): void;
    isAllowed(address: string): boolean;
    sendDataFormat({ op, method, seq, data, cost, hash, }: {
        op: ReceiverOpCodes;
        method: DatabaseMethod;
        seq: number;
        data: any;
        cost: number;
        hash: string;
    }): Buffer;
    transmitterDataFormat(buffer: Buffer): TransmitterDataFormat;
    connect(): void;
}
//# sourceMappingURL=receiver.d.ts.map