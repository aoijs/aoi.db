"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Receiver = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ws_1 = __importDefault(require("ws"));
const database_js_1 = require("../../column/database.js");
const database_js_2 = require("../../keyvalue/database.js");
const enums_js_1 = require("../../typings/enums.js");
const functions_js_1 = require("../../utils/functions.js");
function heartbeat(socket) {
    //@ts-ignore
    socket.isAlive = true;
}
class Receiver extends tiny_typed_emitter_1.TypedEmitter {
    logData;
    connection;
    options;
    clients = new Map();
    _ping = -1;
    lastPingTimestamp = -1;
    _currentSequence = 0;
    #interval;
    constructor(options) {
        super();
        this.connection = new ws_1.default.Server(options.wsOptions);
        this.options = options;
        this.logData = {
            currentLogFile: "",
            logs: {},
            path: this.options.logPath ?? "./logs",
            key: this.options.logEncrypt,
        };
    }
    connect() {
        if (!(0, fs_1.existsSync)(this.options.logPath ?? "./logs/")) {
            const iv = (0, crypto_1.randomBytes)(16).toString("hex");
            (0, fs_1.writeFileSync)(this.options.logPath ?? "./logs/1_1000.log", iv);
            this.logData.logs["1_1000.log"] = iv;
            this.logData.currentLogFile = "./logs/1_1000.log";
        }
        else {
            const files = (0, fs_1.readdirSync)(this.logData.path).sort((a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]));
            this.logData.currentLogFile = files.pop() ?? "";
            files.forEach((x) => {
                const iv = (0, fs_1.readFileSync)(`${this.logData.path}/${x}`)
                    .toString()
                    .split("\n")[0];
                this.logData.logs[x] = iv;
            });
        }
        this.#clearDeadClients();
        this.connection.on("connection", (socket, request) => {
            //@ts-ignore
            socket.isAlive = true;
            socket.on("pong", () => heartbeat(socket));
            if (this.options.whitelistedIps !== "*" &&
                this.options.whitelistedIps.indexOf(request.socket.remoteAddress || "") === -1) {
                socket.close(3000, "Ip Not Whitelisted");
                return;
            }
            this.emit(enums_js_1.WsEventsList.CONNECT);
            socket.on("open", () => { });
            socket.on("message", async (data) => {
                const parsedData = JSON.parse(data);
                this.emit(enums_js_1.WsEventsList.MESSAGE, parsedData);
                if (parsedData.op === enums_js_1.TransmitterOp.REQUEST) {
                    let data;
                    if (parsedData.d.dbType === enums_js_1.WsDBTypes.KeyValue) {
                        const hash = (0, functions_js_1.encrypt)(`name:${parsedData.d.name}@pass:${parsedData.d.pass}@path:${parsedData.d.options.path ?? "./database/"}@type:${parsedData.d.dbType}`, this.logData.key);
                        (parsedData.d.options).path = `${hash.data}_${hash.iv}`;
                        data = {
                            databaseType: enums_js_1.WsDBTypes.KeyValue,
                            db: new database_js_2.KeyValue(parsedData.d.options),
                        };
                        this.clients.set(request.socket.remoteAddress, data);
                    }
                    else {
                        data = {
                            databaseType: enums_js_1.WsDBTypes.WideColumn,
                            db: new database_js_1.WideColumn(parsedData.d.options),
                        };
                        this.clients.set(request.socket.remoteAddress, data);
                    }
                    this._currentSequence += 1;
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_CONNECTION,
                        db: data.databaseType,
                        d: null,
                        t: Date.now(),
                        s: this._currentSequence,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.PING) {
                    const sk = (this.clients.get(request.socket.remoteAddress));
                    this.lastPingTimestamp = Date.now();
                    this._currentSequence += 1;
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_PING,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.BULK_TABLE_OPEN) {
                    this.load(request.socket.remoteAddress || socket.url, parsedData.d);
                    const sk = (this.clients.get(request.socket.remoteAddress));
                    this._currentSequence += 1;
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_TABLES,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.SET) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === enums_js_1.TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    await sk.db.set(parsedData.d.table, parsedData.d.key, parsedData.d.data);
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_SET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.GET) {
                    this._currentSequence += 1;
                    const sk = (this.clients.get(request.socket.remoteAddress));
                    if (sk?.flags === enums_js_1.TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    let get;
                    if (sk.databaseType === enums_js_1.WsDBTypes.KeyValue) {
                        const db = sk.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key);
                    }
                    else {
                        const db = sk.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_GET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: get,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.DELETE) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === enums_js_1.TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (sk.databaseType === enums_js_1.WsDBTypes.KeyValue) {
                        await sk.db.delete(parsedData.d.table, parsedData.d.key);
                    }
                    else if (sk.databaseType === enums_js_1.WsDBTypes.WideColumn) {
                        await sk.db.delete(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_DELETE,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk.databaseType,
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.ALL) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === enums_js_1.TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    let all;
                    if (sk?.databaseType === enums_js_1.WsDBTypes.KeyValue) {
                        all = await sk.db.all(parsedData.d.table, parsedData.d.filter, parsedData.d.limit, parsedData.d.sortOrder);
                    }
                    else if (sk?.databaseType === enums_js_1.WsDBTypes.WideColumn) {
                        all = await (parsedData.d.column
                            ? sk.db.all(parsedData.d.table, parsedData.d.column, parsedData.d.filter, parsedData.d.limit)
                            : sk.db.allData(parsedData.d.table));
                    }
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_ALL,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: sk?.databaseType,
                        d: all,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.CLEAR) {
                    const sk = (this.clients.get(request.socket.remoteAddress || socket.url));
                    if (sk?.flags === enums_js_1.TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: sk.databaseType,
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (sk?.databaseType === enums_js_1.WsDBTypes.KeyValue) {
                        sk.db.clear(parsedData.d.table);
                    }
                    else if (sk.databaseType === enums_js_1.WsDBTypes.WideColumn) {
                        if (!parsedData.d.column) {
                            sk.db.clearTable(parsedData.d.table);
                        }
                        else {
                            sk.db.clearColumn(parsedData.d.table, parsedData.d.column);
                        }
                    }
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.LOGS) {
                }
            });
            socket.on("close", () => {
                this.clients.delete(request.socket.remoteAddress);
            });
        });
        this.connection.on("close", () => {
            clearInterval(this.#interval);
        });
    }
    load(socket, { tables, flags, }) {
        this.clients.set(socket, {
            ...this.clients.get(socket),
            tables,
            flags,
        });
    }
    logSequence(socket, sequence, data) {
        const key = this.options.logEncrypt;
        if (!key)
            throw new Error("Log Encryption key not set");
    }
    #clearDeadClients() {
        this.#interval = setInterval(() => {
            this.connection.clients.forEach((ws) => {
                // @ts-ignore
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                // @ts-ignore
                ws.isAlive = false;
                ws.ping();
            });
        }, 41250);
    }
}
exports.Receiver = Receiver;
//# sourceMappingURL=database.js.map