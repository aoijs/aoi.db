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
            const reqData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Connect, enum_js_1.DatabaseMethod.NOOP, Date.now(), this.data.seq, {
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
        this.emit(enum_js_1.DatabaseEvents.Debug, `[Debug: Received Data] ${(0, util_1.inspect)(data)}`);
    }
    #bindEvents() {
        this.client.on("data", (buffer) => {
            const data = this.receiveDataFormat(buffer);
            switch (data.op) {
                case enum_js_2.ReceiverOpCodes.ConnectionDenied: {
                    this.emit(enum_js_1.DatabaseEvents.Disconnect, data.d);
                }
                case enum_js_2.ReceiverOpCodes.AckConnect:
                    {
                    }
                    break;
                case enum_js_2.ReceiverOpCodes.AckOperation:
                    {
                    }
                    break;
                case enum_js_2.ReceiverOpCodes.Pong:
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
            h: (0, crypto_1.randomBytes)(16).toString("hex"),
        }));
    }
    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(this.sendDataFormat(enum_js_2.TransmitterOpCodes.Ping, enum_js_1.DatabaseMethod.Ping, this.data.lastPingTimestamp, this.data.seq));
    }
    async get(table, key) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Get, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _get = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === enum_js_2.ReceiverOpCodes.AckOperation,
                    data.m === enum_js_1.DatabaseMethod.Get && data.h === sendD.h)) {
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Set, Date.now(), this.data.seq, {
                table,
                key,
                value,
            });
            const _set = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === enum_js_2.ReceiverOpCodes.AckOperation,
                    data.m === enum_js_1.DatabaseMethod.Set && data.h === sendD.h)) {
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Delete, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _delete = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === enum_js_2.ReceiverOpCodes.AckOperation,
                    data.m === enum_js_1.DatabaseMethod.Delete && data.h === sendD.h)) {
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Clear, Date.now(), this.data.seq, {
                table,
            });
            const _clear = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === enum_js_2.ReceiverOpCodes.AckOperation,
                    data.m === enum_js_1.DatabaseMethod.Clear && data.h === sendD.h)) {
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.All, Date.now(), this.data.seq, {
                table,
                query,
                limit,
            });
            const _all = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === enum_js_2.ReceiverOpCodes.AckOperation &&
                    data.m === enum_js_1.DatabaseMethod.All &&
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Has, Date.now(), this.data.seq, {
                table,
                key,
            });
            const _has = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === enum_js_2.ReceiverOpCodes.AckOperation &&
                    data.m === enum_js_1.DatabaseMethod.Has &&
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.FindOne, Date.now(), this.data.seq, {
                table,
                query,
            });
            const _findOne = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === enum_js_2.ReceiverOpCodes.AckOperation &&
                    data.m === enum_js_1.DatabaseMethod.FindOne &&
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.FindMany, Date.now(), this.data.seq, {
                table,
                query,
            });
            const _findMany = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === enum_js_2.ReceiverOpCodes.AckOperation &&
                    data.m === enum_js_1.DatabaseMethod.FindMany &&
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.DeleteMany, Date.now(), this.data.seq, {
                table,
                query,
            });
            const _deleteMany = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === enum_js_2.ReceiverOpCodes.AckOperation &&
                    data.m === enum_js_1.DatabaseMethod.DeleteMany &&
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
            const sendData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Analyze, enum_js_1.DatabaseMethod.Analyze, Date.now(), this.data.seq, {
                table,
                data: {
                    method: enum_js_1.DatabaseMethod[data.method],
                    data: data.data,
                }
            });
            const _analyze = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if (data.op === enum_js_2.ReceiverOpCodes.AckAnalyze &&
                    data.m === enum_js_1.DatabaseMethod.Analyze &&
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
exports.default = Transmitter;
//# sourceMappingURL=transmitter.js.map