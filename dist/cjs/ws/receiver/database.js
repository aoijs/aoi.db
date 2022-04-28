"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Receiver = void 0;
const tiny_typed_emitter_1 = require("tiny-typed-emitter");
const ws_1 = __importDefault(require("ws"));
const database_js_1 = require("../../column/database.js");
const database_js_2 = require("../../keyvalue/database.js");
const enums_js_1 = require("../../typings/enums.js");
class Receiver extends tiny_typed_emitter_1.TypedEmitter {
    connection;
    options;
    clients = new Map();
    _ping = -1;
    lastPingTimestamp = -1;
    _currentSequence = 0;
    db;
    databaseType;
    constructor(options) {
        super();
        this.connection = new ws_1.default.Server(options.wsOptions);
        this.options = options;
        this.databaseType = options.databaseType;
        if (this.databaseType === "KeyValue") {
            this.db = new database_js_2.KeyValue(options.dbOptions);
        }
        else {
            this.db = new database_js_1.WideColumn(options.dbOptions);
        }
        this.db.connect();
    }
    connect() {
        this.connection.on("connection", (socket, request) => {
            if (this.options.whitelistedIps !== "*" &&
                this.options.whitelistedIps.indexOf(request.socket.remoteAddress || "") === -1) {
                socket.close(3000, "Ip Not Whitelisted");
                return;
            }
            this.emit(enums_js_1.WsEventsList.CONNECT);
            socket.on("open", () => { });
            this.clients.set(request.socket.remoteAddress || socket.url, {});
            socket.on("message", async (data) => {
                const parsedData = JSON.parse(data);
                this.emit(enums_js_1.WsEventsList.MESSAGE, parsedData);
                if (parsedData.op === enums_js_1.TransmitterOp.REQUEST) {
                    this._currentSequence += 1;
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_CONNECTION,
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: null,
                        t: Date.now(),
                        s: this._currentSequence,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.PING) {
                    this.lastPingTimestamp = Date.now();
                    this._currentSequence += 1;
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_PING,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.BULK_TABLE_OPEN) {
                    this.load(request.socket.remoteAddress || socket.url, parsedData.d);
                    this._currentSequence += 1;
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_TABLES,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.SET) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === enums_js_1.TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: enums_js_1.WsDBTypes[this.databaseType],
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    await this.db.set(parsedData.d.table, parsedData.d.key, parsedData.d.data);
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_SET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.GET) {
                    this._currentSequence += 1;
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === enums_js_1.TransmitterFlags.WRITE_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: enums_js_1.WsDBTypes[this.databaseType],
                            d: "Database is write only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    let get;
                    if (this.databaseType === "KeyValue") {
                        const db = this.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key);
                    }
                    else {
                        const db = this.db;
                        get = await db.get(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_GET,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: get,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.DELETE) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === enums_js_1.TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: enums_js_1.WsDBTypes[this.databaseType],
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    if (this.databaseType === "KeyValue") {
                        await this.db.delete(parsedData.d.table, parsedData.d.key);
                    }
                    else if (this.databaseType === "WideColumn") {
                        await this.db.delete(parsedData.d.table, parsedData.d.key, parsedData.d.primary);
                    }
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_DELETE,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: null,
                    };
                    socket.send(JSON.stringify(sendData));
                }
                else if (parsedData.op === enums_js_1.TransmitterOp.ALL) {
                    const sk = this.clients.get(request.socket.remoteAddress || socket.url);
                    if (sk?.flags === enums_js_1.TransmitterFlags.READ_ONLY) {
                        const sendData = {
                            op: enums_js_1.ReceiverOp.ERROR,
                            s: this._currentSequence,
                            t: Date.now(),
                            db: enums_js_1.WsDBTypes[this.databaseType],
                            d: "Database is read only",
                        };
                        socket.send(JSON.stringify(sendData));
                        return;
                    }
                    this._currentSequence += 1;
                    let all;
                    if (this.databaseType === "KeyValue") {
                        all = await this.db.all(parsedData.d.table, parsedData.d.filter, parsedData.d.limit, parsedData.d.sortOrder);
                    }
                    else if (this.databaseType === "WideColumn") {
                        all = await (parsedData.d.column
                            ? this.db.all(parsedData.d.table, parsedData.d.column, parsedData.d.filter, parsedData.d.limit)
                            : this.db.allData(parsedData.d.table));
                    }
                    const sendData = {
                        op: enums_js_1.ReceiverOp.ACK_ALL,
                        s: this._currentSequence,
                        t: Date.now(),
                        db: enums_js_1.WsDBTypes[this.databaseType],
                        d: all,
                    };
                    socket.send(JSON.stringify(sendData));
                }
            });
        });
    }
    load(socket, { tables, flags, }) {
        this.clients.set(socket, {
            tables,
            flags,
        });
    }
}
exports.Receiver = Receiver;
//# sourceMappingURL=database.js.map