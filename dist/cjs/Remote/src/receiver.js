"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_events_1 = __importDefault(require("node:events"));
const node_net_1 = require("node:net");
const index_js_1 = require("../../index.js");
const enum_js_1 = require("../typings/enum.js");
const node_crypto_1 = require("node:crypto");
const aoi_structures_1 = require("@aoijs/aoi.structures");
const node_util_1 = require("node:util");
class Receiver extends node_events_1.default {
    server;
    #options;
    allowList = new Set();
    clients = new aoi_structures_1.Group(Infinity);
    usersMap = new aoi_structures_1.Group(Infinity);
    constructor(options) {
        super();
        this.#options = options;
        this.server = (0, node_net_1.createServer)();
        this.server.listen(options.port, options.host, options.backlog, () => {
            this.emit(index_js_1.DatabaseEvents.Connect);
        });
        this.#init(options);
    }
    allowAddress(address) {
        this.allowList.add(address);
    }
    #init(options) {
        // create database and setup user config
        const { userConfig, databaseType, databaseOptions } = options;
        let db = null;
        if (databaseType === "KeyValue") {
            db = this.#createKeyValue(databaseOptions);
        }
        if (!db) {
            throw new Error("Database type not found");
        }
        for (const user of userConfig) {
            this.usersMap.set(user.username, db);
        }
    }
    #createKeyValue(options) {
        const db = new index_js_1.KeyValue(options);
        db.connect();
        return db;
    }
    isAllowed(address) {
        let ipv6 = (0, node_net_1.isIPv6)(address) ? address : "::ffff:" + address;
        return this.allowList.has("*") || this.allowList.has(ipv6);
    }
    async #bindEvents() {
        this.server.on("connection", (socket) => {
            // @ts-ignore
            socket.chunk = "";
            socket.on("connect", () => this.#handleConnect(socket));
            socket.on("data", (data) => this.#handleData(data, socket));
            socket.on("error", (err) => this.#handleError(err, socket));
            socket.on("close", () => this.#handleClose(socket));
        });
    }
    #handleClose(socket) {
        this.emit(index_js_1.DatabaseEvents.Disconnect, socket);
    }
    #handleError(err, socket) {
        this.emit(index_js_1.DatabaseEvents.Error, err, socket);
    }
    #handleConnect(socket) {
        this.emit(index_js_1.DatabaseEvents.Connection, socket);
    }
    async #processData(data, socket) {
        const dataFormat = this.transmitterDataFormat(data);
        const op = dataFormat.op;
        switch (op) {
            case enum_js_1.TransmitterOpCodes.Connect:
                this.#handleConnectRequest(dataFormat, socket);
                break;
            case enum_js_1.TransmitterOpCodes.Ping:
                this.#handlePingRequest(dataFormat, socket);
                break;
            case enum_js_1.TransmitterOpCodes.Disconnect:
                this.#handleDisconnectRequest(dataFormat, socket);
                break;
            case enum_js_1.TransmitterOpCodes.Operation:
                await this.#handleOperationRequest(dataFormat, socket);
                break;
            default:
                this.#handleUnknownRequest(dataFormat, socket);
                break;
        }
        this.#createData(dataFormat);
    }
    async #handleData(data, socket) {
        // @ts-ignore
        socket.chunk += data.toString();
        // @ts-ignore
        let d_index = socket.chunk.indexOf(";");
        while (d_index > -1) {
            try {
                // @ts-ignore
                const string = socket.chunk.substring(0, d_index);
                const dataBuffer = Buffer.from(string);
                await this.#processData(dataBuffer, socket);
                // @ts-ignore
                socket.chunk = socket.chunk.substring(d_index + 1);
                // @ts-ignore
                d_index = socket.chunk.indexOf(";");
            }
            catch (e) {
                // @ts-ignore
                socket.chunk = socket.chunk.substring(d_index + 1);
                // @ts-ignore
                d_index = socket.chunk.indexOf(";");
                continue;
            }
        }
    }
    #handleConnectRequest(dataFormat, socket) {
        const { s, d, h } = dataFormat;
        const { u, p } = d;
        const db = this.usersMap.get(u);
        if (!this.isAllowed(socket.remoteAddress)) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Connection Denied",
                cost: 0,
                hash: h,
                session: "",
            }, socket);
        }
        if (!db) {
            this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "User not found",
                cost: 0,
                hash: h,
                session: "",
            }, socket);
            return;
        }
        if (!this.#options.userConfig.find((user) => user.username === u && user.password === p)) {
            this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Invalid password",
                cost: 0,
                hash: h,
                session: "",
            }, socket);
            return;
        }
        const session = (0, node_crypto_1.randomBytes)(16).toString("hex");
        // @ts-ignore
        socket.userData = {
            username: u,
            session,
            permissions: this.#options.userConfig.find((user) => user.username === u)?.permissions,
        };
        this.clients.set(session, socket);
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckConnect,
            method: index_js_1.DatabaseMethod.NOOP,
            seq: s,
            data: "Connected",
            cost: 0,
            hash: h,
            session,
        }, socket);
    }
    #handlePingRequest(dataFormat, socket) {
        const { s, h, se } = dataFormat;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.Pong,
            method: index_js_1.DatabaseMethod.NOOP,
            seq: s,
            data: "Pong",
            cost: 0,
            hash: h,
            session: se,
        }, socket);
    }
    #handleDisconnectRequest(dataFormat, socket) {
        const { s, h, se } = dataFormat;
        this.clients.delete(se);
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckDisconnect,
            method: index_js_1.DatabaseMethod.NOOP,
            seq: s,
            data: "Disconnected",
            cost: 0,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationRequest(dataFormat, socket) {
        const { se, s, h, m } = dataFormat;
        const db = this.usersMap.get(socket.userData.username);
        if (!db) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "User not found",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        switch (m) {
            case index_js_1.DatabaseMethod.Set:
                await this.#handleOperationSet(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.Get:
                await this.#handleOperationGet(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.Delete:
                await this.#handleOperationDelete(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.All:
                await this.#handleOperationAll(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.FindMany:
                await this.#handleOperationFindMany(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.FindOne:
                await this.#handleOperationFindOne(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.Has:
                await this.#handleOperationHas(dataFormat, socket);
                break;
            case index_js_1.DatabaseMethod.DeleteMany:
                await this.#handleOperationDeleteMany(dataFormat, socket);
                break;
            default: {
                this.#sendResponse({
                    op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                    method: index_js_1.DatabaseMethod.NOOP,
                    seq: s,
                    data: "Unknown Operation",
                    cost: 0,
                    hash: h,
                    session: se,
                }, socket);
                break;
            }
        }
    }
    #handleUnknownRequest(dataFormat, socket) {
        const { s, h, se } = dataFormat;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
            method: index_js_1.DatabaseMethod.NOOP,
            seq: s,
            data: "Unknown Request",
            cost: 0,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationSet(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.ROnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, key, value } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        await db.set(table, key, {
            value,
        });
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.Set,
            seq: s + 1,
            data: "",
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationGet(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.WOnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, key } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await db.get(table, key);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.Get,
            seq: s,
            data: res?.toJSON(),
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationDelete(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.ROnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, key } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await db.delete(table, key);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.Delete,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationAll(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.WOnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, query, limit, order } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await eval(`db.all(table, ${query}, ${limit},order)`);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.All,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationFindMany(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.WOnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, query } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await eval(`db.findMany(table, ${query})`);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.FindMany,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationFindOne(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.WOnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, query } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await eval(`db.findOne(table, ${query})`);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.FindOne,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationHas(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.WOnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, key } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await db.has(table, key);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.Has,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationDeleteMany(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.ROnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table, query } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await eval(`db.deleteMany(table, ${query})`);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.DeleteMany,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationClear(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === enum_js_1.Permissions.ROnly) {
            return this.#sendResponse({
                op: enum_js_1.ReceiverOpCodes.ConnectionDenied,
                method: index_js_1.DatabaseMethod.NOOP,
                seq: s,
                data: "Permission Denied",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        const { table } = d;
        const db = this.usersMap.get(socket.userData.username);
        const startTime = performance.now();
        const res = await db.clear(table);
        const endTime = performance.now();
        const cost = endTime - startTime;
        this.#sendResponse({
            op: enum_js_1.ReceiverOpCodes.AckOperation,
            method: index_js_1.DatabaseMethod.Clear,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    #sendResponse(data, socket) {
        const buffer = this.sendDataFormat(data);
        socket.write(buffer);
        this.#createDebug(data);
    }
    #createDebug(data) {
        this.emit(index_js_1.DatabaseEvents.Debug, `[Debug: Reciever ->  Sent Data]: ${(0, node_util_1.inspect)(data)}`);
    }
    #createData(data) {
        this.emit(index_js_1.DatabaseEvents.Data, `[Debug: Receiver -> Received Data]: ${(0, node_util_1.inspect)(data)}`);
    }
    sendDataFormat({ op, method, seq, data, cost, hash, session, }) {
        const res = {
            op: op,
            m: method,
            t: Date.now(),
            s: seq,
            d: data,
            c: cost,
            h: hash,
            se: session,
        };
        return Buffer.from(JSON.stringify(res) + ";");
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