"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const net_1 = require("net");
const enum_js_1 = require("../../typings/enum.js");
const index_js_1 = require("../../index.js");
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
    pingInterval = null;
    readyAt = -1;
    session;
    constructor(options) {
        super();
        this.client = (0, net_1.createConnection)(options, () => {
            const reqData = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Connect, enum_js_1.DatabaseMethod.NOOP, Date.now(), this.data.seq, {
                u: options.username,
                p: options.password,
            });
            this.data.lastPingTimestamp = Date.now();
            this.client.write(reqData);
        });
        this.options = options;
    }
    static createConnection(options) {
        if (!options.path.startsWith("aoidb://"))
            throw new Error("Invalid Protocol Provided for Transmitter. Required: aoidb://");
        const [_, username, password, host, port] = options.path.split(/aoidb:\/\/|:|@/);
        return new Transmitter({
            host,
            port: Number(port),
            username,
            password,
        });
    }
    #createDebug(data) {
        this.emit(enum_js_1.DatabaseEvents.Debug, `[Debug: Received Data] ${(0, util_1.inspect)(data)}`);
    }
    #bindEvents() {
        this.client.on("data", (buffer) => {
            const data = this.receiveDataFormat(buffer);
            this.data.seq = data.s;
            switch (data.op) {
                case enum_js_2.ReceiverOpCodes.ConnectionDenied: {
                    this.emit(enum_js_1.DatabaseEvents.Disconnect, data.d);
                    this.data.ping = Date.now() - this.data.lastPingTimestamp;
                    return;
                }
                case enum_js_2.ReceiverOpCodes.AckConnect:
                    {
                        this.session = data.se;
                        this.emit("AckConnect", data.d);
                    }
                    break;
                case enum_js_2.ReceiverOpCodes.Pong:
                    {
                        this.data.ping =
                            Date.now() - this.data.lastPingTimestamp;
                    }
                    break;
            }
            this.#createDebug(data);
        });
        this.client.on("close", () => {
            this.emit(enum_js_1.DatabaseEvents.Disconnect, "Connection Closed");
        });
        this.client.on("error", (err) => {
            this.emit(enum_js_1.DatabaseEvents.Error, err);
        });
        this.client.on("connect", () => {
            this.emit(enum_js_1.DatabaseEvents.Connect, "Connected");
        });
    }
    connect() {
        this.#bindEvents();
        this.pingInterval = setInterval(() => {
            this.ping();
        }, 30000);
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
            se: this.session,
        }));
    }
    ping() {
        this.data.lastPingTimestamp = Date.now();
        this.client.write(this.sendDataFormat(enum_js_2.TransmitterOpCodes.Ping, enum_js_1.DatabaseMethod.Ping, this.data.lastPingTimestamp, this.data.seq));
    }
    async #req(op, method, data) {
        return new Promise((resolve, reject) => {
            const sendData = this.sendDataFormat(op, method, Date.now(), this.data.seq, data);
            const _req = (buffer) => {
                const data = this.receiveDataFormat(buffer);
                const sendD = JSON.parse(sendData.toString());
                if ((data.op === op, data.m === method && data.h === sendD.h)) {
                    resolve(data);
                }
                this.client.off("data", _req);
            };
            this.client.write(sendData);
            this.client.on("data", _req);
        });
    }
    async get(table, key) {
        const data = (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Get, {
            table,
            key,
        })).d;
        if (!data)
            return null;
        return new index_js_1.KeyValueData(data);
    }
    async set(table, key, value) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Set, {
            table,
            key,
            value,
        })).d;
    }
    async delete(table, key) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Delete, {
            table,
            key,
        })).d;
    }
    async clear(table) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Clear, {
            table,
        })).d;
    }
    async all(table, query, limit) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.All, {
            table,
            query: query?.toString() ?? ((_) => true).toString(),
            limit,
        })).d.map((x) => new index_js_1.KeyValueData(x));
    }
    async has(table, key) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.Has, {
            table,
            key,
        })).d;
    }
    async findOne(table, query) {
        const data = (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.FindOne, {
            table,
            query: query.toString(),
        })).d;
        if (!data)
            return null;
        return new index_js_1.KeyValueData(data);
    }
    async findMany(table, query) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.FindMany, {
            table,
            query: query.toString(),
        })).d.map((x) => new index_js_1.KeyValueData(x));
    }
    async deleteMany(table, query) {
        return (await this.#req(enum_js_2.TransmitterOpCodes.Operation, enum_js_1.DatabaseMethod.DeleteMany, {
            table,
            query: query.toString(),
        })).d;
    }
    async analyze(table, data) {
        const sendD = this.sendDataFormat(enum_js_2.TransmitterOpCodes.Analyze, enum_js_1.DatabaseMethod[data.method], Date.now(), this.data.seq);
        const res = await this.#req(enum_js_2.TransmitterOpCodes.Analyze, enum_js_1.DatabaseMethod[data.method], {
            table,
            data,
        });
        return this.#formatAnalyzeData(res, JSON.parse(sendD.toString()));
    }
    #formatAnalyzeData(data, sednD) {
        const res = {
            opCode: data.op,
            method: enum_js_1.DatabaseMethod[data.m],
            timestamp: data.t,
            seq: data.s,
            data: {
                value: data.d,
                delay: {
                    toServer: data.t - sednD.t,
                    toClient: Date.now() - data.t,
                    ping: this.data.ping,
                },
            },
            cost: data.c,
            hash: data.h,
        };
        return res;
    }
}
exports.default = Transmitter;
//# sourceMappingURL=transmitter.js.map