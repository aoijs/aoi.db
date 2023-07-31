import EventEmitter from "events";
import { createConnection, Socket } from "net";
import {
    ReceiverDataFormat,
    TransmitterDataFormat,
    TransmitterCreateOptions,
    TransmitterOptions,
    TransmitterAnaylzeDataFormat,
} from "../typings/interface.js";
import { DatabaseOptions, Key, PossibleDatabaseTypes, TransmitterQuery, Value } from "../typings/type.js";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { KeyValue, KeyValueData } from "../../index.js";
import { randomBytes } from "crypto";
import { ReceiverOpCodes, TransmitterOpCodes } from "../typings/enum.js";
import { inspect } from "util";
import { resolve } from "path";
export default class Transmitter<Type extends PossibleDatabaseTypes> extends EventEmitter {
    client: Socket;
    options: TransmitterOptions<Type>;
    data = {
        seq: 0,
        lastPingTimestamp: -1,
        ping: -1,
    };
    readyAt = -1;
    constructor(options: TransmitterOptions<Type>) {
        super();
        this.client = createConnection(options, () => {
            const reqData = this.sendDataFormat(
                TransmitterOpCodes.Connect,
                DatabaseMethod.NOOP,
                Date.now(),
                this.data.seq,
                {
                    u: options.username,
                    p: options.password,
                    db: this.#createDbConfig(),
                },
            );
            this.client.write(reqData);
        });
        this.options = options;
    }
    static createConnection<Type extends PossibleDatabaseTypes>(
        options: TransmitterCreateOptions<Type>,
    ) {
        if (!options.path.startsWith("aoidb://"))
            throw new Error(
                "Invalid Protocol Provided for Transmitter. Required: aoidb://",
            );
        const [_, username, password, host, port] =
            options.path.split(/aoidb:\/\/|:|@/);
        const dbOptions = options.dbOptions;
        return new Transmitter({
            host,
            port: Number(port),
            username,
            password,
            dbOptions,
        });
    }

    #createDbConfig() {
        return {
            t: this.options.dbOptions.type,
            o: this.options.dbOptions.options,
        };
    }
    #createDebug(data: ReceiverDataFormat) {
        this.emit(
            DatabaseEvents.Debug,
            `[Debug: Received Data] ${inspect(data)}`,
        );
    }

    #bindEvents() {
        this.client.on("data", (buffer) => {
            const data = this.receiveDataFormat(buffer);

            switch (data.op) {
                case ReceiverOpCodes.ConnectionDenied: {
                    this.emit(DatabaseEvents.Disconnect, data.d);
                }
                case ReceiverOpCodes.AckConnect:
                    {
                    }
                    break;
                case ReceiverOpCodes.AckOperation:
                    {
                    }
                    break;
                case ReceiverOpCodes.Pong:
                    {
                    }
                    break;
            }

            this.#createDebug(data);
        });
    }

    receiveDataFormat(buffer: Buffer) {
        const data = JSON.parse(buffer.toString());
        return data as ReceiverDataFormat;
    }
    sendDataFormat(
        op: TransmitterOpCodes,
        method: DatabaseMethod,
        timestamp: number,
        seq: number,
        data?: unknown,
    ) {
        return Buffer.from(
            JSON.stringify({
                op: op,
                m: method,
                t: timestamp,
                d: data,
                s: seq,
                h: randomBytes(16).toString("hex"),
            }),
        );
    }

    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(
            this.sendDataFormat(
                TransmitterOpCodes.Ping,
                DatabaseMethod.Ping,
                this.data.lastPingTimestamp,
                this.data.seq,
            ),
        );
    }
    async get(table: string, key: Key<Type>): Promise<Value<Type>> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.Get,
                Date.now(),
                this.data.seq,
                {
                    table,
                    key,
                },
            );
            const _get = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    (data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Get && data.h === sendD.h)
                ) {
                    resolve(data.d);
                }

                this.client.off("data", _get);
            };
            this.client.write(sendData);
            this.client.on("data", _get);
        });
    }

    async set(
        table: string,
        key: Key<Type>,
        value: Value<Type>,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.Set,
                Date.now(),
                this.data.seq,
                {
                    table,
                    key,
                    value,
                },
            );

            const _set = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    (data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Set && data.h === sendD.h)
                ) {
                    resolve();
                }

                this.client.off("data", _set);
            };

            this.client.write(sendData);
            this.client.on("data", _set);
        });
    }

    async delete(table: string, key: Key<Type>): Promise<void> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.Delete,
                Date.now(),
                this.data.seq,
                {
                    table,
                    key,
                },
            );

            const _delete = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    (data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Delete && data.h === sendD.h)
                ) {
                    resolve();
                }

                this.client.off("data", _delete);
            };

            this.client.write(sendData);
            this.client.on("data", _delete);
        });
    }

    async clear(table: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.Clear,
                Date.now(),
                this.data.seq,
                {
                    table,
                },
            );

            const _clear = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    (data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Clear && data.h === sendD.h)
                ) {
                    resolve();
                }

                this.client.off("data", _clear);
            };

            this.client.write(sendData);
            this.client.on("data", _clear);
        });
    }

    async all(
        table: string,
        query?: TransmitterQuery,
        limit?: number,
    ): Promise<Type extends "KeyValue" ? KeyValueData[] : never> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.All,
                Date.now(),
                this.data.seq,
                {
                    table,
                    query,
                    limit,
                },
            );
            const _all = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.All &&
                    data.h === sendD.h
                ) {
                    resolve(data.d);
                }

                this.client.off("data", _all);
            };
            this.client.write(sendData);
            this.client.on("data", _all);
        });
    }

    async has(
        table: string,
        key: Key<Type>,
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.Has,
                Date.now(),
                this.data.seq,
                {
                    table,
                    key,
                },
            );
            const _has = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.Has &&
                    data.h === sendD.h
                ) {
                    resolve(data.d);
                }

                this.client.off("data", _has);
            };
            this.client.write(sendData);
            this.client.on("data", _has);
        });
    }
    async findOne(
        table: string,
        query: TransmitterQuery,
    ): Promise<Type extends "KeyValue" ? KeyValueData : never> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.FindOne,
                Date.now(),
                this.data.seq,
                {
                    table,
                    query,
                },
            );
            const _findOne = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.FindOne &&
                    data.h === sendD.h
                ) {
                    resolve(data.d);
                }

                this.client.off("data", _findOne);
            };
            this.client.write(sendData);
            this.client.on("data", _findOne);
        });
    }
    async findMany(
        table: string,
        query: TransmitterQuery,
    ) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.FindMany,
                Date.now(),
                this.data.seq,
                {
                    table,
                    query,
                },
            );
            const _findMany = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.FindMany &&
                    data.h === sendD.h
                ) {
                    resolve(data.d);
                }

                this.client.off("data", _findMany);
            };
            this.client.write(sendData);
            this.client.on("data", _findMany);
        });
    }

    async deleteMany(
        table: string,
        query: TransmitterQuery,
    ) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Operation,
                DatabaseMethod.DeleteMany,
                Date.now(),
                this.data.seq,
                {
                    table,
                    query,
                },
            );
            const _deleteMany = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.DeleteMany &&
                    data.h === sendD.h
                ) {
                    resolve(data.d);
                }

                this.client.off("data", _deleteMany);
            };
            this.client.write(sendData);
            this.client.on("data", _deleteMany);
        });
    }

    async analyze(
        table: string,
        data:TransmitterAnaylzeDataFormat
    ) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                TransmitterOpCodes.Analyze,
                DatabaseMethod.Analyze,
                Date.now(),
                this.data.seq,
                {
                    table,
                    data: {
                        method: DatabaseMethod[data.method],
                        data: data.data,
                    }
                },
            );
            const _analyze = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as ReceiverDataFormat;
                if (
                    data.op === ReceiverOpCodes.AckAnalyze &&
                    data.m === DatabaseMethod.Analyze &&
                    data.h === sendD.h
                ) {
                    resolve(data);
                }

                this.client.off("data", _analyze);
            };
            this.client.write(sendData);
            this.client.on("data", _analyze);
        });
    }
}
