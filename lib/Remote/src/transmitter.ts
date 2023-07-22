import EventEmitter from "events";
import { createConnection, Socket } from "net";
import {
    ReceiverDataFormat,
    TransmitterDataFormat,
    TransmitterCreateOptions,
    TransmitterOptions,
} from "../typings/interface.js";
import { DatabaseOptions } from "../typings/type.js";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { KeyValue, KeyValueData } from "../../index.js";
import { randomBytes } from "crypto";
import { ReceiverOpCodes } from "../typings/enum.js";
import { inspect } from "util";
import { resolve } from "path";
export default class Transmitter<
    Database extends KeyValue,
> extends EventEmitter {
    client: Socket;
    options: TransmitterOptions;
    data = {
        seq: 0,
        lastPingTimestamp: -1,
        ping: -1,
    };
    readyAt = -1;
    constructor(options: TransmitterOptions) {
        super();
        this.client = createConnection(options, () => {
            this.emit(DatabaseEvents.Connect);
            this.readyAt = Date.now();
            this.#bindEvents();
        });
        this.options = options;
    }
    static createConnection(options: TransmitterCreateOptions) {
        if (!options.path.startsWith("aoidb://"))
            throw new Error(
                "Invalid Protocol Provided for Transmitter. Required: aoidb://",
            );
        const [_, username, password, host, port] =
            options.path.split(/aoidb:\/\/|:|@/);
        const dbOptions: DatabaseOptions = options.dbOptions;
        return new Transmitter({
            host,
            port: Number(port),
            username,
            password,
            dbOptions,
        });
    }

    #createDebug(data:ReceiverDataFormat) {
        this.emit(DatabaseEvents.Debug, `[Debug: Received Data] ${inspect(data)}`)
    }

    #bindEvents() {
        this.client.on('data', (buffer) => {
            const data = this.receiveDataFormat(buffer);

            if(data.opCode === ReceiverOpCodes.Pong) {
                this.data.ping = Date.now() - this.data.lastPingTimestamp;
            }

            this.#createDebug(data);
        });
    }

    receiveDataFormat(buffer: Buffer) {
        const data = JSON.parse(buffer.toString());
        return {
            opCode: data.op,
            timestamp: data.t,
            seq: data.s,
            data: data.d,
            cost: data.c,
            hash: data.h,
            bucket: data.b,
        } as ReceiverDataFormat;
    }
    sendDataFormat(
        method: DatabaseMethod,
        timestamp: number,
        seq: number,
        data?: unknown,
    ) {
        return Buffer.from(
            JSON.stringify({
                op: method,
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
                DatabaseMethod.Ping,
                this.data.lastPingTimestamp,
                this.data.seq,
            ),
        );
    }
    async get(
        table: string,
        key: Database extends KeyValue ? string : never,
    ): Promise<Database extends KeyValue ? KeyValueData : never> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
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
                ) as TransmitterDataFormat;
                if (
                    data.opCode === DatabaseMethod.Get &&
                    data.hash === sendD.h
                ) {
                    resolve(data.data);
                }

                this.client.off("data", _get);
            };
            this.client.write(sendData);
            this.client.on("data", _get);
        });
    }

    async set(
        table: string,
        key: Database extends KeyValue ? string : never,
        value: Database extends KeyValue ? KeyValueData : never,
    ): Promise<void> {
        return new Promise((resolve,reject) => {
            const sendData = this.sendDataFormat(
                DatabaseMethod.Set,Date.now(),this.data.seq,
            )
        })
    }

    async delete(
        table: string,
        key: Database extends KeyValue ? string : never,
    ): Promise<void> {
        const sendData = this.sendDataFormat(
            DatabaseMethod.Delete,
            Date.now(),
            this.data.seq,
            {
                table,
                key,
            },
        );
    }

    async clear(table: string): Promise<void> {
        const sendData = this.sendDataFormat(
            DatabaseMethod.Clear,
            Date.now(),
            this.data.seq,
            {
                table,
            },
        );
    }

    async all( table: string,
        query?: (value: Database extends KeyValue ? KeyValueData : never, index: number) => boolean,
        limit?: number 
    ): Promise<Database extends KeyValue ? KeyValueData[] : never> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
                DatabaseMethod.All,
                Date.now(),
                this.data.seq,
                {
                    table,
                    query,
                    limit
                },
            );
            const _all = (buffer: Buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(
                    sendData.toString(),
                ) as TransmitterDataFormat;
                if (
                    data.opCode === DatabaseMethod.All &&
                    data.hash === sendD.h
                ) {
                    resolve(data.data);
                }

                this.client.off("data", _all);
            };
            this.client.write(sendData);
            this.client.on("data", _all);
        });
    }

    async has(
        table: string,
        key: Database extends KeyValue ? string : never,
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(
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
                ) as TransmitterDataFormat;
                if (
                    data.opCode === DatabaseMethod.Has &&
                    data.hash === sendD.h
                ) {
                    resolve(data.data);
                }

                this.client.off("data", _has);
            };
            this.client.write(sendData);
            this.client.on("data", _has);
        });
    }
}
