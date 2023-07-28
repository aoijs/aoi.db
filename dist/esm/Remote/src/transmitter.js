import EventEmitter from "events";
import { createConnection } from "net";
import { DatabaseEvents, DatabaseMethod } from "../../typings/enum.js";
import { randomBytes } from "crypto";
import { ReceiverOpCodes } from "../typings/enum.js";
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
            this.emit(DatabaseEvents.Connect);
            this.readyAt = Date.now();
            this.#bindEvents();
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
    #createDebug(data) {
        this.emit(DatabaseEvents.Debug, `[Debug: Received Data] ${inspect(data)}`);
    }
    #bindEvents() {
        this.client.on('data', (buffer) => {
            const data = this.receiveDataFormat(buffer);
            if (data.opCode === ReceiverOpCodes.Pong) {
                this.data.ping = Date.now() - this.data.lastPingTimestamp;
            }
            this.#createDebug(data);
        });
    }
    receiveDataFormat(buffer) {
        const data = JSON.parse(buffer.toString());
        return {
            opCode: data.op,
            timestamp: data.t,
            seq: data.s,
            data: data.d,
            cost: data.c,
            hash: data.h,
            bucket: data.b,
        };
    }
    sendDataFormat(method, timestamp, seq, data) {
        return Buffer.from(JSON.stringify({
            op: method,
            t: timestamp,
            d: data,
            s: seq,
            h: randomBytes(16).toString("hex"),
        }));
    }
    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(this.sendDataFormat(DatabaseMethod.Ping, this.data.lastPingTimestamp, this.data.seq));
    }
    async get(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(DatabaseMethod.Get, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _get = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.opCode === DatabaseMethod.Get &&
                    data.hash === sendD.h) {
                    resolve(data.data);
                }
                this.client.off("data", _get);
            };
            this.client.write(sendData);
            this.client.on("data", _get);
        });
    }
    async set(table, key, value) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(DatabaseMethod.Set, Date.now(), this.data.seq);
        });
    }
    async delete(table, key) {
        const sendData = this.sendDataFormat(DatabaseMethod.Delete, Date.now(), this.data.seq, {
            table,
            key,
        });
    }
    async clear(table) {
        const sendData = this.sendDataFormat(DatabaseMethod.Clear, Date.now(), this.data.seq, {
            table,
        });
    }
    async all(table, query, limit) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(DatabaseMethod.All, Date.now(), this.data.seq, {
                table,
                query,
                limit
            });
            const _all = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.opCode === DatabaseMethod.All &&
                    data.hash === sendD.h) {
                    resolve(data.data);
                }
                this.client.off("data", _all);
            };
            this.client.write(sendData);
            this.client.on("data", _all);
        });
    }
    async has(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(DatabaseMethod.Has, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _has = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.opCode === DatabaseMethod.Has &&
                    data.hash === sendD.h) {
                    resolve(data.data);
                }
                this.client.off("data", _has);
            };
            this.client.write(sendData);
            this.client.on("data", _has);
        });
    }
}
//# sourceMappingURL=transmitter.js.map