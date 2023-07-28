"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const net_1 = require("net");
const enum_js_1 = require("../../typings/enum.js");
const crypto_1 = require("crypto");
const enum_js_2 = require("../typings/enum.js");
const util_1 = require("util");
class Transmitter extends events_1.default {
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
        this.client = (0, net_1.createConnection)(options, () => {
            this.emit(enum_js_1.DatabaseEvents.Connect);
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
        this.emit(enum_js_1.DatabaseEvents.Debug, `[Debug: Received Data] ${(0, util_1.inspect)(data)}`);
    }
    #bindEvents() {
        this.client.on('data', (buffer) => {
            const data = this.receiveDataFormat(buffer);
            if (data.opCode === enum_js_2.ReceiverOpCodes.Pong) {
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
            h: (0, crypto_1.randomBytes)(16).toString("hex"),
        }));
    }
    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(this.sendDataFormat(enum_js_1.DatabaseMethod.Ping, this.data.lastPingTimestamp, this.data.seq));
    }
    async get(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(enum_js_1.DatabaseMethod.Get, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _get = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.opCode === enum_js_1.DatabaseMethod.Get &&
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
            const sendData = this.sendDataFormat(enum_js_1.DatabaseMethod.Set, Date.now(), this.data.seq);
        });
    }
    async delete(table, key) {
        const sendData = this.sendDataFormat(enum_js_1.DatabaseMethod.Delete, Date.now(), this.data.seq, {
            table,
            key,
        });
    }
    async clear(table) {
        const sendData = this.sendDataFormat(enum_js_1.DatabaseMethod.Clear, Date.now(), this.data.seq, {
            table,
        });
    }
    async all(table, query, limit) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(enum_js_1.DatabaseMethod.All, Date.now(), this.data.seq, {
                table,
                query,
                limit
            });
            const _all = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.opCode === enum_js_1.DatabaseMethod.All &&
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
            const sendData = this.sendDataFormat(enum_js_1.DatabaseMethod.Has, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _has = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.opCode === enum_js_1.DatabaseMethod.Has &&
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
exports.default = Transmitter;
//# sourceMappingURL=transmitter.js.map