/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "node:events";
import { Server, Socket } from "node:net";
import { ReceiverOptions, TransmitterDataFormat } from "../typings/interface.js";
import { DatabaseMethod, KeyValue } from "../../index.js";
import { ReceiverOpCodes } from "../typings/enum.js";
import { Group } from "@akarui/structures";
export default class Receiver extends EventEmitter {
    #private;
    server: Server;
    allowList: Set<string>;
    clients: Group<string, Socket>;
    usersMap: Group<string, KeyValue>;
    constructor(options: ReceiverOptions);
    allowAddress(address: string): void;
    isAllowed(address: string): boolean;
    sendDataFormat({ op, method, seq, data, cost, hash, session, }: {
        op: ReceiverOpCodes;
        method: DatabaseMethod;
        seq: number;
        data: any;
        cost: number;
        hash: string;
        session: string;
    }): Buffer;
    transmitterDataFormat(buffer: Buffer): TransmitterDataFormat;
    connect(): Promise<void>;
}
//# sourceMappingURL=receiver.d.ts.map