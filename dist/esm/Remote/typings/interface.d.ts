/// <reference types="node" />
import { Socket, TcpNetConnectOpts } from "net";
import { DatabaseOptions, PossibleDatabaseTypes } from "./type.js";
import { DatabaseMethod } from "../../index.js";
import { Permissions } from "./enum.js";
export interface TransmitterOptions<Type extends PossibleDatabaseTypes> extends TcpNetConnectOpts {
    username: string;
    password: string;
}
export interface ReceiverOptions {
    host: string;
    port: number;
    backlog?: number;
    databaseType: PossibleDatabaseTypes;
    databaseOptions: DatabaseOptions<PossibleDatabaseTypes>;
    userConfig: UserConfig[];
}
export interface UserConfig {
    username: string;
    permissions: Permissions;
    password: string;
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
    se: string;
}
export interface TransmitterDataFormat {
    op: number;
    m: number;
    t: number;
    s: number;
    d: any;
    h: string;
    se: string;
}
export interface TransmitterAnaylzeDataFormat {
    method: keyof typeof DatabaseMethod;
    data: any;
}
export interface ISocket extends Socket {
    userData: {
        username: string;
        session: string;
        permissions: Permissions;
    };
}
//# sourceMappingURL=interface.d.ts.map