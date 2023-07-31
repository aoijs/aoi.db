/// <reference types="node" />
import { TcpNetConnectOpts } from "net";
import { DatabaseOptions, PossibleDatabaseTypes } from "./type.js";
import { DatabaseMethod } from "../../index.js";
export interface TransmitterOptions<Type extends PossibleDatabaseTypes> extends TcpNetConnectOpts {
    dbOptions: {
        type: Type;
        options: DatabaseOptions<Type>;
    };
    username: string;
    password: string;
}
export interface ReceiverOptions {
    host: string;
    port: number;
    backlog?: number;
}
export interface TransmitterCreateOptions<Type extends PossibleDatabaseTypes> {
    path: `aoidb://${string}:${string}@${string}:${number}`;
    dbOptions: {
        type: Type;
        options: DatabaseOptions<Type>;
    };
}
export interface ReceiverDataFormat {
    op: number;
    m: number;
    t: number;
    s: number;
    d: any;
    c: number;
    h: string;
}
export interface TransmitterDataFormat {
    op: number;
    m: number;
    t: number;
    s: number;
    d: any;
    h: string;
}
export interface TransmitterAnaylzeDataFormat {
    method: keyof typeof DatabaseMethod;
    data: any;
}
//# sourceMappingURL=interface.d.ts.map