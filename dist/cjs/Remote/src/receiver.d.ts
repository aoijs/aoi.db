/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import EventEmitter from "node:events";
import { Server } from "node:net";
import { ReceiverDataFormat, ReceiverOptions, TransmitterDataFormat } from "../typings/interface.js";
export default class Receiver extends EventEmitter {
    #private;
    server: Server;
    options: ReceiverOptions;
    allowList: Set<string>;
    constructor(options: ReceiverOptions);
    allowAddress(address: string): void;
    sendDataFormat(buffer: Buffer): ReceiverDataFormat;
    transmitterDataFormat(buffer: Buffer): TransmitterDataFormat;
}
//# sourceMappingURL=receiver.d.ts.map