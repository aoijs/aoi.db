import EventEmitter from "events";
import { createConnection } from "net";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { randomBytes } from "crypto";
import { ReceiverOpCodes, TransmitterOpCodes } from "../typings/enum.js";
import { inspect } from "util";
export default class Transmitter extends EventEmitter {
    client;
    options;
    data = {
        seq: 0,
        lastPingTimestamp: -1,
        ping: -1,
    };
    readyAt = -1;
    constructor(options) {
        super();
        this.client = createConnection(options, () => {
            const reqData = this.sendDataFormat(TransmitterOpCodes.Connect, DatabaseMethod.NOOP, Date.now(), this.data.seq, {
                u: options.username,
                p: options.password,
                db: this.#createDbConfig(),
            });
            this.client.write(reqData);
        });
        this.options = options;
    }
    static createConnection(options) {
        if (!options.path.startsWith("aoidb://"))
            throw new Error("Invalid Protocol Provided for Transmitter. Required: aoidb://");
        const [_, username, password, host, port] = options.path.split(/aoidb:\/\/|:|@/);
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
    #createDebug(data) {
        this.emit(DatabaseEvents.Debug, `[Debug: Received Data] ${inspect(data)}`);
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
    receiveDataFormat(buffer) {
        const data = JSON.parse(buffer.toString());
        return data;
    }
    sendDataFormat(op, method, timestamp, seq, data) {
        return Buffer.from(JSON.stringify({
            op: op,
            m: method,
            t: timestamp,
            d: data,
            s: seq,
            h: randomBytes(16).toString("hex"),
        }));
    }
    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(this.sendDataFormat(TransmitterOpCodes.Ping, DatabaseMethod.Ping, this.data.lastPingTimestamp, this.data.seq));
    }
    async get(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.Get, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _get = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Get && data.h === sendD.h)) {
                    resolve(data.d);
                }
                this.client.off("data", _get);
            };
            this.client.write(sendData);
            this.client.on("data", _get);
        });
    }
    async set(table, key, value) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.Set, Date.now(), this.data.seq, {
                table,
                key,
                value,
            });
            const _set = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Set && data.h === sendD.h)) {
                    resolve();
                }
                this.client.off("data", _set);
            };
            this.client.write(sendData);
            this.client.on("data", _set);
        });
    }
    async delete(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.Delete, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _delete = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Delete && data.h === sendD.h)) {
                    resolve();
                }
                this.client.off("data", _delete);
            };
            this.client.write(sendData);
            this.client.on("data", _delete);
        });
    }
    async clear(table) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.Clear, Date.now(), this.data.seq, {
                table,
            });
            const _clear = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === ReceiverOpCodes.AckOperation,
                    data.m === DatabaseMethod.Clear && data.h === sendD.h)) {
                    resolve();
                }
                this.client.off("data", _clear);
            };
            this.client.write(sendData);
            this.client.on("data", _clear);
        });
    }
    async all(table, query, limit) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.All, Date.now(), this.data.seq, {
                table,
                query,
                limit,
            });
            const _all = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.All &&
                    data.h === sendD.h) {
                    resolve(data.d);
                }
                this.client.off("data", _all);
            };
            this.client.write(sendData);
            this.client.on("data", _all);
        });
    }
    async has(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.Has, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _has = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.Has &&
                    data.h === sendD.h) {
                    resolve(data.d);
                }
                this.client.off("data", _has);
            };
            this.client.write(sendData);
            this.client.on("data", _has);
        });
    }
    async findOne(table, query) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.FindOne, Date.now(), this.data.seq, {
                table,
                query,
            });
            const _findOne = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.FindOne &&
                    data.h === sendD.h) {
                    resolve(data.d);
                }
                this.client.off("data", _findOne);
            };
            this.client.write(sendData);
            this.client.on("data", _findOne);
        });
    }
    async findMany(table, query) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.FindMany, Date.now(), this.data.seq, {
                table,
                query,
            });
            const _findMany = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.FindMany &&
                    data.h === sendD.h) {
                    resolve(data.d);
                }
                this.client.off("data", _findMany);
            };
            this.client.write(sendData);
            this.client.on("data", _findMany);
        });
    }
    async deleteMany(table, query) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Operation, DatabaseMethod.DeleteMany, Date.now(), this.data.seq, {
                table,
                query,
            });
            const _deleteMany = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === ReceiverOpCodes.AckOperation &&
                    data.m === DatabaseMethod.DeleteMany &&
                    data.h === sendD.h) {
                    resolve(data.d);
                }
                this.client.off("data", _deleteMany);
            };
            this.client.write(sendData);
            this.client.on("data", _deleteMany);
        });
    }
    async analyze(table, data) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(TransmitterOpCodes.Analyze, DatabaseMethod.Analyze, Date.now(), this.data.seq, {
                table,
                data: {
                    method: DatabaseMethod[data.method],
                    data: data.data,
                }
            });
            const _analyze = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === ReceiverOpCodes.AckAnalyze &&
                    data.m === DatabaseMethod.Analyze &&
                    data.h === sendD.h) {
                    resolve(data);
                }
                this.client.off("data", _analyze);
            };
            this.client.write(sendData);
            this.client.on("data", _analyze);
        });
    }
}
//# sourceMappingURL=transmitter.js.map