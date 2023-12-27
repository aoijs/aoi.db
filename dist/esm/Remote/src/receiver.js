"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_events_1 = __importDefault(require("node:events"));
const node_net_1 = require("node:net");
const index_js_1 = require("../../index.js");
const enum_js_1 = require("../typings/enum.js");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_util_1 = require("node:util");
class Receiver extends node_events_1.default {
    server;
    options;
    allowList = new Set();
    connections = new Map();
    constructor(options) {
        super();
        this.options = options;
        this.server = (0, node_net_1.createServer)();
        this.server.listen(options.port, options.host, options.backlog, () => {
            this.emit(index_js_1.DatabaseEvents.Connect);
        });
    }
    allowAddress(address) {
        if (address === "*")
            this.allowList.add("*");
        else if ((0, node_net_1.isIPv4)(address)) {
            //convert it to ipv6
            const ipv6 = "::ffff:" + address;
            this.allowList.add(ipv6);
        }
        else if ((0, node_net_1.isIPv6)(address)) {
            this.allowList.add(address);
        }
        else {
            throw new Error("Invalid IP Address Provided");
        }
    }
    isAllowed(address) {
        let ipv6 = (0, node_net_1.isIPv6)(address) ? address : "::ffff:" + address;
        return this.allowList.has("*") || this.allowList.has(ipv6);
    }
    async #createOwner(options, username, password) {
        const text = `@name=${username}@pass=${password}`;
        const hash = (0, index_js_1.encrypt)(text, options.encryptionConfig.securityKey);
        await (0, promises_1.writeFile)(`${options.dataConfig?.path}/owner.hash`, `${hash.iv}:${hash.data}`, { encoding: "utf-8" });
    }
    #bindEvents() {
        this.server.on("connection", (socket) => {
            this.emit(index_js_1.DatabaseEvents.Debug, "[Receiver]: New Connection with ip: " + socket.remoteAddress);
            socket.on("data", async (buffer) => {
                const data = this.transmitterDataFormat(buffer);
                this.emit(index_js_1.DatabaseEvents.Debug, `[Receiver]: Received Data: ${(0, node_util_1.inspect)(data)}`);
                let isAnaylze = false;
                switch (data.op) {
                    case enum_js_1.TransmitterOpCodes.Connect:
                        {
                            if (!this.isAllowed(socket.remoteAddress)) {
                                const res = this.sendDataFormat({
                                    op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                                    method: data.m,
                                    seq: data.s,
                                    data: "IP Address Not Allowed",
                                    cost: 0,
                                    hash: data.h,
                                });
                                socket.end(res);
                                return;
                            }
                            const username = data.d.u;
                            const password = data.d.p;
                            const db = data.d.db.t;
                            if (db === "KeyValue") {
                                const options = data.d.db
                                    .o;
                                const mainFolder = Buffer.from(username).toString("base64url");
                                const defaultFolder = options.dataConfig?.path ?? "database";
                                options.dataConfig = {
                                    path: `./${mainFolder}_${defaultFolder}`,
                                    referencePath: `./reference`,
                                };
                                options.fileConfig = {
                                    extension: options.fileConfig?.extension || ".sql",
                                    maxSize: options.fileConfig?.maxSize ||
                                        20 * 1024 * 1024,
                                    transactionLogPath: `./transactions`,
                                };
                                const keyvalue = new index_js_1.KeyValue(options);
                                if ((0, node_fs_1.existsSync)(options.dataConfig.path)) {
                                    const ownerHsh = await (0, promises_1.readFile)(`${options.dataConfig.path}/owner.hash`, { encoding: "utf-8" });
                                    const [iv, ecrypted] = ownerHsh.split(":");
                                    const hash = { iv, data: ecrypted };
                                    const decrypted = (0, index_js_1.decrypt)(hash, options.encryptionConfig.securityKey);
                                    const splits = decrypted.split("@").slice(1);
                                    const [name, pass] = splits.map((x) => {
                                        const [_, prop] = x.split("=");
                                        return prop;
                                    });
                                    if (name !== username ||
                                        pass !== password) {
                                        const res = this.sendDataFormat({
                                            op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                                            method: data.m,
                                            seq: data.s,
                                            data: "Invalid Username or Password",
                                            cost: 0,
                                            hash: data.h,
                                        });
                                        socket.end(res);
                                        return;
                                    }
                                }
                                await keyvalue.connect();
                                if (!(0, node_fs_1.existsSync)(options.dataConfig.path + "/owner.hash")) {
                                    await this.#createOwner(options, username, password);
                                }
                                this.connections.set(socket.remoteAddress, keyvalue);
                                const res = this.sendDataFormat({
                                    op: enum_js_1.ReceiverOpCodes.AckConnect,
                                    method: data.m,
                                    seq: data.s + 1,
                                    data: "Connected",
                                    cost: 0,
                                    hash: data.h,
                                });
                                socket.write(res);
                            }
                        }
                        break;
                    case enum_js_1.TransmitterOpCodes.Ping:
                        {
                            const res = this.sendDataFormat({
                                op: enum_js_1.ReceiverOpCodes.Pong,
                                method: data.m,
                                seq: data.s,
                                data: "Pong",
                                cost: 0,
                                hash: data.h,
                            });
                            socket.write(res);
                        }
                        break;
                    case enum_js_1.TransmitterOpCodes.Analyze:
                        isAnaylze = true;
                    /* FALLTHROUGH */
                    case enum_js_1.TransmitterOpCodes.Operation:
                        {
                            const db = this.connections.get(socket.remoteAddress);
                            if (!db) {
                                const res = this.sendDataFormat({
                                    op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                                    method: data.m,
                                    seq: data.s,
                                    data: "Not Connected",
                                    cost: 0,
                                    hash: data.h,
                                });
                                socket.end(res);
                                return;
                            }
                            const method = data.m;
                            let seq = data.s;
                            switch (method) {
                                case index_js_1.DatabaseMethod.Set:
                                    {
                                        seq++;
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const value = data.d.value;
                                        const startTime = performance.now();
                                        const d = await db.set(table, key, value);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.Get:
                                    {
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const startTime = performance.now();
                                        const d = await db.get(table, key);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.Delete:
                                    {
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const startTime = performance.now();
                                        const d = await db.delete(table, key);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d?.value ?? null,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.Has:
                                    {
                                        const table = data.d.table;
                                        const key = data.d.key;
                                        const startTime = performance.now();
                                        const d = await db.has(table, key);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d ?? false,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.Clear:
                                    {
                                        const table = data.d.table;
                                        const startTime = performance.now();
                                        const d = await db.clear(table);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.All:
                                    {
                                        const table = data.d.table;
                                        const query = (0, index_js_1.parseTransmitterQuery)(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.all(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.FindOne:
                                    {
                                        const table = data.d.table;
                                        const query = (0, index_js_1.parseTransmitterQuery)(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.findOne(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.FindMany:
                                    {
                                        const table = data.d.table;
                                        const query = (0, index_js_1.parseTransmitterQuery)(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.findMany(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                                case index_js_1.DatabaseMethod.DeleteMany:
                                    {
                                        seq++;
                                        const table = data.d.table;
                                        const query = (0, index_js_1.parseTransmitterQuery)(data.d.query);
                                        const startTime = performance.now();
                                        const d = await db.deleteMany(table, query);
                                        const cost = performance.now() - startTime;
                                        const res = this.sendDataFormat({
                                            op: isAnaylze
                                                ? enum_js_1.ReceiverOpCodes.AckAnalyze
                                                : enum_js_1.ReceiverOpCodes.AckOperation,
                                            method: data.m,
                                            seq: seq,
                                            data: d,
                                            cost: cost,
                                            hash: data.h,
                                        });
                                        socket.write(res);
                                    }
                                    break;
                            }
                        }
                        break;
                }
            });
        });
    }
    sendDataFormat({ op, method, seq, data, cost, hash, }) {
        const res = {
            op: op,
            m: method,
            t: Date.now(),
            s: seq,
            d: data,
            c: cost,
            h: hash,
        };
        return Buffer.from(JSON.stringify(res));
    }
    transmitterDataFormat(buffer) {
        return JSON.parse(buffer.toString());
    }
    connect() {
        return this.#bindEvents();
    }
}
exports.default = Receiver;
//# sourceMappingURL=receiver.js.map