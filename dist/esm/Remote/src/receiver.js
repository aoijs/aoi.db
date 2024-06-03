import EventEmitter from "node:events";
import { createServer, isIPv6 } from "node:net";
import { DatabaseEvents, DatabaseMethod, KeyValue, } from "../../index.js";
import { Permissions, ReceiverOpCodes, TransmitterOpCodes, } from "../typings/enum.js";
import { randomBytes } from "node:crypto";
import { Group } from "@akarui/structures";
import { inspect } from "node:util";
export default class Receiver extends EventEmitter {
    server;
    #options;
    allowList = new Set();
    clients = new Group(Infinity);
    usersMap = new Group(Infinity);
    constructor(options) {
        super();
        this.#options = options;
        this.server = createServer();
        this.server.listen(options.port, options.host, options.backlog, () => {
            this.emit(DatabaseEvents.Connect);
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
        const db = new KeyValue(options);
        db.connect();
        return db;
    }
    isAllowed(address) {
        let ipv6 = isIPv6(address) ? address : "::ffff:" + address;
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
        this.emit(DatabaseEvents.Disconnect, socket);
    }
    #handleError(err, socket) {
        this.emit(DatabaseEvents.Error, err, socket);
    }
    #handleConnect(socket) {
        this.emit(DatabaseEvents.Connection, socket);
    }
    async #processData(data, socket) {
        const dataFormat = this.transmitterDataFormat(data);
        const op = dataFormat.op;
        switch (op) {
            case TransmitterOpCodes.Connect:
                this.#handleConnectRequest(dataFormat, socket);
                break;
            case TransmitterOpCodes.Ping:
                this.#handlePingRequest(dataFormat, socket);
                break;
            case TransmitterOpCodes.Disconnect:
                this.#handleDisconnectRequest(dataFormat, socket);
                break;
            case TransmitterOpCodes.Operation:
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
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
                seq: s,
                data: "Connection Denied",
                cost: 0,
                hash: h,
                session: "",
            }, socket);
        }
        if (!db) {
            this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
                seq: s,
                data: "Invalid password",
                cost: 0,
                hash: h,
                session: "",
            }, socket);
            return;
        }
        const session = randomBytes(16).toString("hex");
        // @ts-ignore
        socket.userData = {
            username: u,
            session,
            permissions: this.#options.userConfig.find((user) => user.username === u)?.permissions,
        };
        this.clients.set(session, socket);
        this.#sendResponse({
            op: ReceiverOpCodes.AckConnect,
            method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.Pong,
            method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckDisconnect,
            method: DatabaseMethod.NOOP,
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
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
                seq: s,
                data: "User not found",
                cost: 0,
                hash: h,
                session: se,
            }, socket);
        }
        switch (m) {
            case DatabaseMethod.Set:
                await this.#handleOperationSet(dataFormat, socket);
                break;
            case DatabaseMethod.Get:
                await this.#handleOperationGet(dataFormat, socket);
                break;
            case DatabaseMethod.Delete:
                await this.#handleOperationDelete(dataFormat, socket);
                break;
            case DatabaseMethod.All:
                await this.#handleOperationAll(dataFormat, socket);
                break;
            case DatabaseMethod.FindMany:
                await this.#handleOperationFindMany(dataFormat, socket);
                break;
            case DatabaseMethod.FindOne:
                await this.#handleOperationFindOne(dataFormat, socket);
                break;
            case DatabaseMethod.Has:
                await this.#handleOperationHas(dataFormat, socket);
                break;
            case DatabaseMethod.DeleteMany:
                await this.#handleOperationDeleteMany(dataFormat, socket);
                break;
            default: {
                this.#sendResponse({
                    op: ReceiverOpCodes.ConnectionDenied,
                    method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.ConnectionDenied,
            method: DatabaseMethod.NOOP,
            seq: s,
            data: "Unknown Request",
            cost: 0,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationSet(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.ROnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.Set,
            seq: s + 1,
            data: "",
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationGet(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.Get,
            seq: s,
            data: res?.toJSON(),
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationDelete(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.ROnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.Delete,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationAll(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.All,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationFindMany(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.FindMany,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationFindOne(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.FindOne,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationHas(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.WOnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.Has,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationDeleteMany(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.ROnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.DeleteMany,
            seq: s,
            data: res,
            cost: cost,
            hash: h,
            session: se,
        }, socket);
    }
    async #handleOperationClear(dataFormat, socket) {
        const { s, m, d, h, se } = dataFormat;
        if (socket.userData.permissions === Permissions.ROnly) {
            return this.#sendResponse({
                op: ReceiverOpCodes.ConnectionDenied,
                method: DatabaseMethod.NOOP,
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
            op: ReceiverOpCodes.AckOperation,
            method: DatabaseMethod.Clear,
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
        this.emit(DatabaseEvents.Debug, `[Debug: Reciever ->  Sent Data]: ${inspect(data)}`);
    }
    #createData(data) {
        this.emit(DatabaseEvents.Data, `[Debug: Receiver -> Received Data]: ${inspect(data)}`);
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
//# sourceMappingURL=receiver.js.map