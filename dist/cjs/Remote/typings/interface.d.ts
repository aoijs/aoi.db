/// <reference types="node" />
import { TcpNetConnectOpts } from "net";
import { DatabaseOptions } from "./type.js";
export interface TransmitterOptions extends TcpNetConnectOpts {
    dbOptions: DatabaseOptions;
    username: string;
    password: string;
}
export interface ReceiverOptions {
    host: string;
    port: number;
    backlog?: number;
}
export interface TransmitterCreateOptions {
    path: `aoidb://${string}:${string}@${string}:${number}`;
    dbOptions: DatabaseOptions;
}
export interface ReceiverDataFormat {
    opCode: number;
    timestamp: number;
    seq: number;
    data: any;
    cost: number;
    hash: string;
    bucket: string;
}
export interface TransmitterDataFormat {
    op: number;
    t: number;
    s: number;
    d: any;
    c: number;
    h: string;
}
//# sourceMappingURL=interface.d.ts.map